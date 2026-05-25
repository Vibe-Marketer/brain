export interface GrainSourceRecord {
  id: string;
  account_email?: string | null;
  oauth_token_expires?: number | null;
}

export async function resolveGrainSource<T extends GrainSourceRecord = GrainSourceRecord>(
  supabase: any,
  userId: string,
  sourceId: string | null,
  columns = "id",
): Promise<T | null> {
  let query = supabase
    .from("import_sources")
    .select(columns)
    .eq("user_id", userId)
    .eq("source_app", "grain");

  query = sourceId
    ? query.eq("id", sourceId)
    : query.eq("is_active", true).order("updated_at", { ascending: false }).limit(1);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as T | null;
}
