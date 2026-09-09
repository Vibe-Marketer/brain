/**
 * Admin Center Organizations section (36-05) — internal, platform-admin-only
 * tool for merging duplicate organizations and unclaiming domains (ORG-03).
 * Mirrors UsersSection.tsx's search/filter header + table + empty/loading/
 * error states; each row expands inline (Radix Collapsible, mirroring
 * WorkspaceSidebarPane's row-expand pattern) to reveal that org's domains
 * (each with an "Unclaim" action) and aliases.
 */
import { useMemo, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { RiArrowRightSLine, RiBuilding4Line } from "@remixicon/react";
import { useAdminOrganizations } from "@/hooks/useAdminOrganizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MergeOrganizationsDialog } from "@/components/dialogs/MergeOrganizationsDialog";
import { UnclaimDomainDialog } from "@/components/dialogs/UnclaimDomainDialog";
import type { AdminOrganization, AdminOrganizationDomain } from "@/services/admin-organizations.service";

interface AdminOrganizationRowProps {
  org: AdminOrganization;
  onMergeClick: (org: AdminOrganization) => void;
  onUnclaimClick: (domain: AdminOrganizationDomain, org: AdminOrganization) => void;
}

function AdminOrganizationRow({ org, onMergeClick, onUnclaimClick }: AdminOrganizationRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  // WR-01 (36-REVIEW.md): already-merged orgs (canonical_organization_id set)
  // are greyed out and lose the live "Merge into…" action — re-merging a
  // loser silently overwrites its existing canonical pointer with no
  // warning, so the row must make "already merged" visible before that
  // action is offered.
  const isMerged = !!org.canonical_organization_id;

  return (
    <>
      <tr
        onClick={() => setIsOpen((open) => !open)}
        className={cn("cursor-pointer hover:bg-muted/50", isMerged && "opacity-50")}
      >
        <td className="px-4 py-3 max-w-[280px]">
          <div className="flex items-center gap-2">
            <div className="font-medium text-foreground truncate" title={org.name}>
              {org.name}
            </div>
            {isMerged && (
              <span
                className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                title={
                  org.merged_at
                    ? `Merged ${new Date(org.merged_at).toLocaleDateString()}`
                    : "Merged"
                }
              >
                Merged
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-foreground tabular-nums">{org.domains.length}</td>
        <td className="px-4 py-3 text-foreground tabular-nums">{org.aliases.length}</td>
        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap tabular-nums">
          {new Date(org.created_at).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            {isMerged ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Merged{org.merged_at ? ` ${new Date(org.merged_at).toLocaleDateString()}` : ""}
              </span>
            ) : (
              <Button
                variant="hollow"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMergeClick(org);
                }}
              >
                Merge into…
              </Button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen((open) => !open);
              }}
              aria-label={isOpen ? `Collapse ${org.name}` : `Expand ${org.name}`}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <RiArrowRightSLine
                size={14}
                className={cn(
                  "text-muted-foreground transition-transform duration-300",
                  isOpen && "rotate-90",
                )}
              />
            </button>
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={5} className="p-0">
          <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
            <Collapsible.Content className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
              <div className="space-y-4 border-t border-border bg-muted/30 px-6 py-4">
                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                    Domains
                  </h4>
                  {org.domains.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No claimed domains.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {org.domains.map((domain) => (
                        <li
                          key={domain.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate text-foreground" title={domain.domain}>
                            {domain.domain}
                          </span>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              Claimed {new Date(domain.claimed_at).toLocaleDateString()}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnclaimClick(domain, org);
                              }}
                            >
                              Unclaim
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                    Aliases
                  </h4>
                  {org.aliases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No aliases.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {org.aliases.map((alias) => (
                        <li key={alias.id} className="truncate text-sm text-foreground" title={alias.alias}>
                          {alias.alias}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        </td>
      </tr>
    </>
  );
}

export default function OrganizationsSection() {
  const { data: organizations, isLoading, error } = useAdminOrganizations();
  const [search, setSearch] = useState("");
  const [mergingOrg, setMergingOrg] = useState<AdminOrganization | null>(null);
  const [unclaimTarget, setUnclaimTarget] = useState<{
    domain: AdminOrganizationDomain;
    org: AdminOrganization;
  } | null>(null);

  const totalOrganizations = organizations?.length ?? 0;
  const totalVerifiedDomains = useMemo(
    () => (organizations ?? []).reduce((sum, org) => sum + org.domains.length, 0),
    [organizations],
  );

  const filtered = (organizations ?? []).filter((org) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    if (org.name.toLowerCase().includes(q)) return true;
    return org.domains.some((d) => d.domain.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            Organizations
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums mt-1">
            {totalOrganizations} organizations · {totalVerifiedDomains} verified domains
          </p>
        </div>
        <div className="w-64">
          <Input
            placeholder="Search name or domain…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-destructive">
          Failed to load organizations.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-4">
            <RiBuilding4Line className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No organizations match your search</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different name or domain.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Domains</th>
                <th className="px-4 py-3 font-medium">Aliases</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((org) => (
                <AdminOrganizationRow
                  key={org.id}
                  org={org}
                  onMergeClick={setMergingOrg}
                  onUnclaimClick={(domain, unclaimOrg) => setUnclaimTarget({ domain, org: unclaimOrg })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MergeOrganizationsDialog
        open={!!mergingOrg}
        onOpenChange={(open) => {
          if (!open) setMergingOrg(null);
        }}
        losingOrg={mergingOrg}
        organizations={organizations ?? []}
      />
      <UnclaimDomainDialog
        open={!!unclaimTarget}
        onOpenChange={(open) => {
          if (!open) setUnclaimTarget(null);
        }}
        domain={unclaimTarget?.domain ?? null}
        org={unclaimTarget?.org ?? null}
      />
    </div>
  );
}
