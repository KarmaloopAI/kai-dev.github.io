// GitHub Pages SPA redirect handling
// This handles the special redirect format used by GitHub Pages
(function(l) {
  // Check if there's a redirect parameter in the query string
  if (l.search[1] === '/') {
    var decoded = l.search.slice(1).split('&').map(function(s) { 
      return s.replace(/~and~/g, '&')
    }).join('?');
    
    // Update the URL without the redirect parameter
    window.history.replaceState(null, null,
      l.pathname.slice(0, -1) + decoded + l.hash
    );
  }
}(window.location));

// Also handle hash-based redirects from 404 page
if (window.location.hash && window.location.pathname === '/') {
  var path = window.location.hash.slice(1); // remove '#'
  if (path && path !== '/') {
    // Store in sessionStorage for the app to handle
    sessionStorage.setItem('redirect-path', path);
    // Clean the URL
    window.history.replaceState(null, '', path);
  }
}
