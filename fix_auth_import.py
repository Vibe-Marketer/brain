import os

src_dir = '/Users/Naegele/dev/brain/src'
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            
            if "import { useAuth } from '@/hooks/useAuth'" in content:
                content = content.replace("import { useAuth } from '@/hooks/useAuth'", "import { useAuth } from '@/contexts/AuthContext'")
                with open(path, 'w') as f:
                    f.write(content)
                print(f"Updated auth import in {path}")
