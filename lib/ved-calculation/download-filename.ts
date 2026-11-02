/** HTTP headers allow latin-1 only. Encode Unicode filenames using RFC 5987. */
export function vedExcelContentDisposition(filename:string):string{
 const ascii="VED-calculation.xlsx";
 const encoded=encodeURIComponent(filename).replace(/['()*]/g,ch=>"%"+ch.charCodeAt(0).toString(16).toUpperCase());
 return 'attachment; filename="'+ascii+'"; filename*=UTF-8\'\''+encoded;
}
