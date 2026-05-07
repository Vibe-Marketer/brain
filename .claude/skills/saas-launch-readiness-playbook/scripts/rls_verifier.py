#!/usr/bin/env python3
"""
rls_verifier.py

Supabase RLS audit for SaaS launch readiness.

Three checks against your Postgres schema:

  1. TABLES — pg_tables.rowsecurity + pg_policies count
       [PASS] RLS enabled + has policies
       [WARN] RLS enabled but NO policies (locks everyone out — usually unintentional)
       [FAIL] RLS DISABLED (CRITICAL — public read/write)

  2. VIEWS — security_invoker setting on pg_class.reloptions
       Views in PG 15+ run with the OWNER's permissions by default, which BYPASSES RLS.
       Setting `security_invoker = true` makes them honor the caller's RLS instead.
       [PASS] security_invoker=true
       [FAIL] security_invoker=false (or unset) — view bypasses RLS

  3. SECURITY DEFINER FUNCTIONS — pg_proc.prosecdef
       Functions marked SECURITY DEFINER run as the function owner — bypassing RLS.
       Each one needs a manual auth check inside the function body.
       [INFO] Listed for manual review — script can't tell if the function is safe.

Exit code:
  0 — no FAIL findings
  1 — one or more FAIL findings (RLS disabled OR view bypass)
  2 — connection or configuration error

Usage:
  export DATABASE_URL='postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:5432/postgres'
  python3 rls_verifier.py
  python3 rls_verifier.py --json
  python3 rls_verifier.py --schema public --schema auth

Where to find DATABASE_URL:
  Supabase dashboard -> Project Settings -> Database -> Connection string -> URI

Requires:
  pip install psycopg2-binary
  (or psycopg if you prefer the v3 driver — script auto-detects)
"""

import argparse
import json
import os
import sys


def connect(database_url: str):
    """Connect to Postgres using whichever driver is available."""
    try:
        import psycopg2
        return psycopg2.connect(database_url), "psycopg2"
    except ImportError:
        pass

    try:
        import psycopg
        return psycopg.connect(database_url), "psycopg"
    except ImportError:
        pass

    print(
        "ERROR: No Postgres driver found. Install one of:\n"
        "  pip install psycopg2-binary\n"
        "  pip install psycopg[binary]",
        file=sys.stderr,
    )
    sys.exit(2)


def fetch_table_rls(conn, schemas: list) -> list:
    """Tables: rowsecurity flag + policy count."""
    schema_list = ", ".join(f"'{s}'" for s in schemas)
    query = f"""
        SELECT
          t.schemaname,
          t.tablename,
          t.rowsecurity,
          COALESCE(p.policy_count, 0) AS policy_count
        FROM pg_tables t
        LEFT JOIN (
          SELECT schemaname, tablename, COUNT(*) AS policy_count
          FROM pg_policies
          GROUP BY schemaname, tablename
        ) p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
        WHERE t.schemaname IN ({schema_list})
        ORDER BY t.schemaname, t.tablename;
    """
    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return [
        {
            "schema": r[0],
            "table": r[1],
            "rls_enabled": bool(r[2]),
            "policy_count": int(r[3]),
        }
        for r in rows
    ]


def fetch_view_security(conn, schemas: list) -> list:
    """Views: check security_invoker setting (PG 15+)."""
    schema_list = ", ".join(f"'{s}'" for s in schemas)
    # security_invoker is stored in pg_class.reloptions as 'security_invoker=true'
    query = f"""
        SELECT
          n.nspname AS schema,
          c.relname AS view_name,
          c.reloptions
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'v'
          AND n.nspname IN ({schema_list})
        ORDER BY n.nspname, c.relname;
    """
    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()

    result = []
    for r in rows:
        reloptions = r[2] or []
        # reloptions comes back as a list of 'key=value' strings (or None)
        has_invoker = any(
            opt.lower().replace(" ", "") == "security_invoker=true"
            for opt in reloptions
        )
        result.append({
            "schema": r[0],
            "view": r[1],
            "security_invoker": has_invoker,
            "reloptions": list(reloptions),
        })
    return result


def fetch_security_definer_funcs(conn, schemas: list) -> list:
    """Functions marked SECURITY DEFINER (bypass RLS)."""
    schema_list = ", ".join(f"'{s}'" for s in schemas)
    query = f"""
        SELECT
          n.nspname AS schema,
          p.proname AS function_name,
          pg_get_function_arguments(p.oid) AS args,
          p.prosecdef AS is_security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ({schema_list})
          AND p.prosecdef = true
        ORDER BY n.nspname, p.proname;
    """
    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return [
        {"schema": r[0], "function": r[1], "args": r[2]}
        for r in rows
    ]


def classify_table(row: dict) -> str:
    if not row["rls_enabled"]:
        return "FAIL"
    if row["policy_count"] == 0:
        return "WARN"
    return "PASS"


def classify_view(row: dict) -> str:
    return "PASS" if row["security_invoker"] else "FAIL"


def print_text_report(tables, views, definers):
    print("\n" + "=" * 78)
    print("  Supabase RLS Audit — Launch Readiness")
    print("=" * 78)

    # SECTION 1: Tables
    print("\n[1/3] TABLES")
    print("-" * 78)
    if not tables:
        print("  No tables found in the specified schema(s).")
    else:
        fail = [r for r in tables if classify_table(r) == "FAIL"]
        warn = [r for r in tables if classify_table(r) == "WARN"]
        passed = [r for r in tables if classify_table(r) == "PASS"]

        if fail:
            print("\n  [FAIL] RLS DISABLED — public read/write (BLOCK LAUNCH):")
            for r in fail:
                print(f"          - {r['schema']}.{r['table']}")
        if warn:
            print("\n  [WARN] RLS enabled but no policies (likely locks out all users):")
            for r in warn:
                print(f"          - {r['schema']}.{r['table']}")
        if passed:
            print("\n  [PASS] RLS enabled with policies:")
            for r in passed:
                print(f"          - {r['schema']}.{r['table']} ({r['policy_count']} policies)")
        print(f"\n  Tables summary: {len(passed)} pass / {len(warn)} warn / {len(fail)} fail / {len(tables)} total")

    # SECTION 2: Views
    print("\n[2/3] VIEWS (security_invoker check)")
    print("-" * 78)
    if not views:
        print("  No views found in the specified schema(s).")
    else:
        v_fail = [r for r in views if classify_view(r) == "FAIL"]
        v_pass = [r for r in views if classify_view(r) == "PASS"]
        if v_fail:
            print("\n  [FAIL] Views WITHOUT security_invoker=true (bypass RLS):")
            for r in v_fail:
                print(f"          - {r['schema']}.{r['view']}")
        if v_pass:
            print("\n  [PASS] Views with security_invoker=true:")
            for r in v_pass:
                print(f"          - {r['schema']}.{r['view']}")
        print(f"\n  Views summary: {len(v_pass)} pass / {len(v_fail)} fail / {len(views)} total")

    # SECTION 3: SECURITY DEFINER functions
    print("\n[3/3] SECURITY DEFINER FUNCTIONS (manual review required)")
    print("-" * 78)
    if not definers:
        print("  No SECURITY DEFINER functions in the specified schema(s).")
    else:
        print("\n  These functions BYPASS RLS — verify each has its own auth check:\n")
        for r in definers:
            print(f"          - {r['schema']}.{r['function']}({r['args']})")
        print(f"\n  Found {len(definers)} SECURITY DEFINER function(s) — review function bodies.")

    # Footer with fixes
    print("\n" + "=" * 78)
    has_table_fail = any(classify_table(r) == "FAIL" for r in tables)
    has_view_fail = any(classify_view(r) == "FAIL" for r in views)

    if has_table_fail:
        print("\nHow to fix table FAIL:")
        print("  ALTER TABLE schema.table_name ENABLE ROW LEVEL SECURITY;")
        print("  Then add policies — typically one for each of SELECT/INSERT/UPDATE/DELETE.")
        print("  https://supabase.com/docs/guides/auth/row-level-security")

    if has_view_fail:
        print("\nHow to fix view FAIL (PG 15+):")
        print("  ALTER VIEW schema.view_name SET (security_invoker = true);")
        print("  This makes the view honor the caller's RLS instead of the owner's.")

    if definers:
        print("\nHow to review SECURITY DEFINER functions:")
        print("  \\sf+ schema.function_name   (in psql)")
        print("  Look for: 'auth.uid()' checks, ownership validation, or input sanitization.")
        print("  Without these, the function can be called to bypass RLS.")

    print("=" * 78 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Audit Supabase RLS configuration before launch (tables + views + SECURITY DEFINER)."
    )
    parser.add_argument(
        "--schema", action="append", default=None,
        help="Schemas to audit (default: public). Repeat flag for multiple.",
    )
    parser.add_argument("--json", action="store_true", help="Output JSON for CI consumption.")
    args = parser.parse_args()

    schemas = args.schema or ["public"]

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print(
            "ERROR: DATABASE_URL environment variable not set.\n"
            "Find it at: Supabase dashboard -> Project Settings -> Database -> Connection string -> URI",
            file=sys.stderr,
        )
        return 2

    conn, _driver = connect(database_url)
    try:
        tables = fetch_table_rls(conn, schemas)
        views = fetch_view_security(conn, schemas)
        definers = fetch_security_definer_funcs(conn, schemas)
    finally:
        conn.close()

    if args.json:
        out = {
            "tables": [{**r, "status": classify_table(r)} for r in tables],
            "views": [{**r, "status": classify_view(r)} for r in views],
            "security_definer_functions": definers,
            "summary": {
                "tables_fail": sum(1 for r in tables if classify_table(r) == "FAIL"),
                "tables_warn": sum(1 for r in tables if classify_table(r) == "WARN"),
                "views_fail": sum(1 for r in views if classify_view(r) == "FAIL"),
                "security_definer_count": len(definers),
            },
        }
        print(json.dumps(out, indent=2))
    else:
        print_text_report(tables, views, definers)

    table_fails = sum(1 for r in tables if classify_table(r) == "FAIL")
    view_fails = sum(1 for r in views if classify_view(r) == "FAIL")
    return 1 if (table_fails > 0 or view_fails > 0) else 0


if __name__ == "__main__":
    sys.exit(main())
