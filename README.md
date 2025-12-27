# TapeVibe 🎵  
_A retro digital mixtape experience – Made by **Mohit Chamoli**_ [code_file:14]

## ✨ Overview

TapeVibe is a retro‑styled web app that lets you create and share digital mixtapes that feel like old cassette tapes.[code_file:14] Add songs from modern streaming platforms, generate a unique link, and let your friends “insert” the tape and listen with a nostalgic UI.[code_file:15]

---

## 🚀 Features

- **Multi‑platform tracks** – Add up to 5 songs from:
  - Spotify (recommended)
  - YouTube
  - SoundCloud[code_file:15]

- **Retro cassette player UI**
  - Animated cassette with spinning reels
  - Insert / Eject tape animation
  - Dynamic label showing recipient name[code_file:14]

- **Synchronized controls**
  - Custom Play / Pause / Previous / Next buttons
  - Play button synced with Spotify embedded player using messaging
  - Cassette reels spin only when audio is playing[code_file:15][web:32]

- **Shareable mixtapes**
  - Tracks + recipient name encoded into the URL query params
  - Opening the link jumps straight to the player page
  - Tape auto‑inserts and is ready to play for the receiver[code_file:15]

- **Responsive layout**
  - Desktop: cassette radio + compact Spotify/SoundCloud widget in the corner
  - Mobile: bottom‑docked mini player with full‑width layout[code_file:16]

---

## 🛠 Tech Stack

- **Frontend:**  
  - HTML5  
  - CSS3 (custom responsive layout, cassette/radio theming)  
  - Vanilla JavaScript (no frameworks)[code_file:14][code_file:16]

- **Embeds & APIs:**  
  - Spotify Embed iFrame with messaging for control sync[web:28][web:35]  
  - YouTube IFrame Player API for video/audio playback[web:21]  
  - SoundCloud embedded player for streaming audio[web:26]


---

## 🎧 Usage

### 1. Create a TapeVibe

1. Open the app in your browser.  
2. Enter an optional “Recipient Name” (used on the cassette label).  
3. Paste up to 5 links from Spotify / YouTube / SoundCloud.  
4. Click **“CREATE TAPEVIBE”** to generate the mixtape and update the URL.[code_file:14][code_file:15]

### 2. Share With a Friend

- Copy the URL from the address bar (it contains `?playback&tracks=...&to=...`).  
- Send it over WhatsApp, Instagram, SMS, etc.[code_file:15]

### 3. Friend’s Experience

1. Friend opens the link.  
2. App jumps straight to player page and auto‑inserts the tape.  
3. Spotify/YouTube/SoundCloud player loads with the first track.  
4. Press play on the TapeVibe controls (or embedded player) and enjoy.[code_file:15]

---

## 🙌 Credits

Built with love by **Mohit Chamoli** as a blend of nostalgic design and modern web tech.[code_file:14]


## 📦 Project Structure

