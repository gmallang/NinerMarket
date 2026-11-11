// Notification payloads are data, not navigation instructions. Resolve every
// URL against this origin and never pass an attacker-supplied absolute URL to
// navigate()/openWindow(), which would otherwise let a forged push redirect a
// NinerMarket tab to another website.
function safeInternalUrl(raw) {
  if (typeof raw !== "string" || raw === "") return "/";
  try {
    const target = new URL(raw, self.location.origin);
    if (target.origin !== self.location.origin) return "/";
    // Return the absolute same-origin URL. A pathname such as "//evil.com"
    // would be treated as protocol-relative if handed to navigate() directly.
    return target.href;
  } catch {
    return "/";
  }
}

self.addEventListener("push", (event) => {
  let data = { title: "NinerMarket", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeInternalUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
