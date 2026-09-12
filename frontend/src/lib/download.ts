export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
): void {
  if (typeof window === 'undefined') {
    return;
  }
  const blob = new Blob(['\ufeff' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
