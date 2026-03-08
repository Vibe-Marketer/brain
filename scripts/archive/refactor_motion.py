import os
import glob

def refactor_framer_motion(directory):
    count = 0
    for root, dirs, files in os.walk(directory):
        for _file in files:
            if not _file.endswith(('.tsx', '.ts')):
                continue
            
            filepath = os.path.join(root, _file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if 'framer-motion' in content:
                # Replace importing paths
                new_content = content.replace('"framer-motion"', '"motion/react"')
                new_content = new_content.replace("'framer-motion'", "'motion/react'")
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated: {filepath}")
                    count += 1
    
    print(f"Total files updated: {count}")

if __name__ == '__main__':
    refactor_framer_motion('/Users/Naegele/dev/brain/src')
