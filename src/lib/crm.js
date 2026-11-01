export const fold = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function crmSearch(contact, query) {
  const q=fold(query).trim();
  if(!q)return true;
  const words=q.split(/\s+/);
  const text=fold([contact.full_name,contact.email,contact.phone,contact.company].join(" "));
  return words.every(word=>text.includes(word)) || (/^[+\d\s().-]+$/.test(q) && (contact.phone || "").replace(/\D/g,"").includes(q.replace(/\D/g,"")));
}
