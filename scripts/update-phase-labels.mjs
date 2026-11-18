import fs from 'node:fs';
const edits=[
 ['src/app/admin/layout.tsx',/Phase 4[^\r\n]*Menu/g,'Phase 6 - Orders'],
 ['src/app/admin/menu/page.tsx',/Phase 4[^\r\n]*Live database/g,'Live database'],
 ['src/components/customer/site-header.tsx',/Browsing preview[^\r\n]*ordering not connected/g,'Browse our menu or view your cart'],
];
for(const [file,pattern,text] of edits){const old=fs.readFileSync(file,'utf8');fs.writeFileSync(file,old.replace(pattern,text));}
