# 🍌 Banana Chat — Landing Page

A premium, responsive landing page for the Banana Chat social platform. Built with pure HTML, CSS, and JavaScript — no frameworks.

## 🌐 Live Demo

[**banana-chat-website.vercel.app**](https://website-six-tawny-20.vercel.app)

## ✨ Features

- **Bento Grid Layout** — Modern, content-dense grid showcasing app features
- **Glassmorphism Design** — Frosted glass cards with depth and layering
- **Interactive Cursor Glow** — Mouse-following radial glow effect
- **CSS-Only Marquee** — Smooth horizontal scroll showcasing app screenshots
- **Scroll Animations** — Elements fade in as they enter the viewport
- **Mobile-Responsive** — Full hamburger nav + optimized layouts for all screen sizes
- **Dark Theme** — Premium dark-first design with vibrant accent colors
- **Zero Dependencies** — Pure vanilla HTML/CSS/JS, no build step required

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/Soumoditya/banana-chat-website.git
cd banana-chat-website

# Open in browser (no build step!)
open index.html
# or use a local server
npx serve .
```

## 📁 Structure

```
├── index.html   # Main page structure
├── style.css    # Full design system + responsive breakpoints
└── script.js    # Cursor glow, mobile menu, marquee, scroll animations
```

## 🎨 Design Highlights

| Feature | Implementation |
|---------|---------------|
| Color System | CSS custom properties with HSL palette |
| Typography | System font stack with fallbacks |
| Glass Effect | `backdrop-filter: blur()` with layered borders |
| Animations | CSS `@keyframes` + JS `IntersectionObserver` |
| Responsive | Mobile-first breakpoints at 480px, 768px, 1024px |

## 📄 License

MIT — free to use, modify, and distribute.

## 🔗 Related

- **Banana Chat App** — The full React Native social platform (private repo)
