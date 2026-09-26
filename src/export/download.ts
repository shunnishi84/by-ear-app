export function download(data: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeName = (s: string) => (s.trim() || 'score').replace(/[\\/:*?"<>|]+/g, '_');
