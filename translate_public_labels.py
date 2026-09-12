import shutil, datetime

TARGET = "src/PublicDashboard.tsx"

# Labels that appear more than once (two layout variants), so we replace
# ALL occurrences rather than asserting exactly 1 match.
replacements = [
    ('label="Current Visitors"', 'label="Actuele bezoekers"'),
    ('label="Current Water Temperature"', 'label="Actuele watertemperatuur"'),
    ('label="Current Air Temperature"', 'label="Actuele luchttemperatuur"'),
    ('label="Swimming Water Status"', 'label="Zwemwaterstatus"'),
    ('?? "Unknown"', '?? "Onbekend"'),
]

ts = datetime.datetime.now().strftime('%Y%m%d%H%M%S')

with open(TARGET, 'r', encoding='utf-8') as f:
    content = f.read()

shutil.copy(TARGET, f'{TARGET}.bak.{ts}')

total = 0
for old, new in replacements:
    count = content.count(old)
    if count == 0:
        print(f'NOT FOUND: {old}')
        continue
    content = content.replace(old, new)
    total += count
    print(f'[{count}x] {old}  ->  {new}')

with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\n{total} replacements applied to {TARGET}. Backup: {TARGET}.bak.{ts}')
