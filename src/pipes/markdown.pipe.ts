
import { Pipe, PipeTransform, inject, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Declare external libraries to TypeScript
declare const marked: any;
declare const DOMPurify: any;

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      console.warn('marked.js or DOMPurify not loaded. Cannot render markdown.');
      // Sanitize the plain text value as a fallback
      return this.sanitizer.sanitize(SecurityContext.HTML, value) || '';
    }

    // 1. Parse markdown to HTML
    const unsafeHtml = marked.parse(value);
    
    // 2. Sanitize HTML to prevent XSS attacks
    const safeHtmlString = DOMPurify.sanitize(unsafeHtml);

    // 3. Trust the sanitized HTML for rendering
    return this.sanitizer.bypassSecurityTrustHtml(safeHtmlString);
  }
}
