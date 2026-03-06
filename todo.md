# Todo

## PWA Improvements

### High Priority

- [x] Create Web App Manifest (manifest.ts exists)
- [ ] Fix `apple-mobile-web-app-status-bar-style` meta tag - add `content="black-translucent"`
- [ ] Enhance service worker: precache more assets, add proper caching strategies, create offline.html fallback, add cache expiration
- [ ] Create maskable icon variant (512x512 with 80px safe zone padding)

### Medium Priority

- [ ] Add install prompt handling (beforeinstallprompt)
- [ ] Add service worker update notification for users
- [ ] Add offline detection UI feedback
- [ ] Add cache cleanup for old versions on activate

### Low Priority

- [ ] Background sync for offline actions (if needed)
- [ ] Push notifications (if needed)

### Safe Area (Optional Refinements)

- [ ] Add horizontal safe area insets (padding-left/right) for landscape notches
- [ ] Remove deprecated `constant()` fallback in globals.css (env() is sufficient for iOS 11.2+)
- [ ] Consider CSS variables for safe area values
