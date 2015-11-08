import marked from 'marked';
import sanitize from 'sanitize-html';

import body from '../templates/body';


function main() {
    const html = marked(document.body.innerText, {
        gfm: true,
        tables: true,
        sanitize: true,
        smartypants: true
    });

    const headMatcher = /<h([1-6])[^>]*>.*<\/h\1>/gi;
    const headTagMatcher = /<h([1-6])[^>]*id="([^"]*)"[^>]*>(.*)<\/h\1>/i;

    const nav = html.match(headMatcher).map(line => {
        const match = line.match(headTagMatcher);
        return {
            level: Number(match[1]),
            id: match[2],
            text: sanitize(match[3], {allowedTags: []})
        };
    });

    document.body.innerHTML = body({content: html, nav: nav});
    document.firstChild.className = 'markdown-viewer';
}

if (document.contentType === 'text/plain') {
    main();
}
