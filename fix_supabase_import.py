import os

src_dir = '/Users/Naegele/dev/brain/src'
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            
            if "import { supabase } from '@/lib/supabase'" in content:
                content = content.replace("import { supabase } from '@/lib/supabase'", "import { supabase } from '@/integrations/supabase/client'")
                with open(path, 'w') as f:
                    f.write(content)
                print(f"Updated {path}")
