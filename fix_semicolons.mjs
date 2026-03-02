import fs from 'fs';

let content = fs.readFileSync('supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql', 'utf8');

// replace $function$ with $function$; unless it already has it
content = content.replace(/\$function\$/g, '$function$;');
// but now some might be $function$;; or $function$; if they were starting pairs
// Actually, it's safer to just replace ^\$function\$$ with $function$;
// let's do a more precise replacement (only at the end of function bodies, where it is alone on a line)

// Find all occurrences of "$function$" that are NOT followed by a semicolon and are alone on a line
content = content.replace(/^\$function\$(?!;)/gm, '$function$;');

// Wait, the starting tag is "$function$\nBEGIN" - we don't want to add semicolon there!
// The starting tag is: "AS $function$"
// The ending tag is just "$function$"
content = content.replace(/^AS \$function\$\;/gm, 'AS $function$');

fs.writeFileSync('supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql', content);
