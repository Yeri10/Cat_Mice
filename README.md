<img width="1512" height="826" alt="Cat   Mouse" src="https://github.com/user-attachments/assets/34c39490-1a03-4124-94f6-8e1eba09fcb8" />


https://github.com/user-attachments/assets/3df0fb2d-6ad2-4909-99ff-7d1c2b988a9d


# Cat, Mice: Multiplayer Territory Game

A real-time multiplayer spatial pursuit game

**Group Project**
Yirun Ye & Shuran Zhang

GitHub: [https://github.com/Yeri10/Cat_Mice](https://github.com/Yeri10/Cat_Mice)

Web: [https://cat-mice.onrender.com/](https://cat-mice.onrender.com/)


# 1. Project Description 

Cat & Mouse: Multiplayer Territory Game is a real-time multiplayer interactive system that transforms shared digital space into a playable territory of pursuit, evasion, and spatial negotiation.

Players join the same room through a shared browser link and are assigned roles: one Cat and multiple Mice. Once the game begins, all participants appear within a shared 2D spatial environment where movement, distance, and proximity determine the outcome of the game.

The project explores multiplayer presence, spatial interaction, and performative digital territory through playful competition and collaboration.


# 2. Game Structure 

The game consists of two main phases: Lobby and Running.

**Lobby**

Players enter the same room through a shared browser link.
Click a seat to join the game.
The host starts the game.
The system automatically assigns roles (Cat / Mouse).

**Running**

All players enter a shared map.
Use the keyboard (WASD or arrow keys) to move.
The Cat chases the Mice.
When a Mouse is touched by the Cat, it becomes caught and can no longer move.
The game includes a countdown timer.
The game ends when time runs out or when all Mice have been caught.

# 3. Interaction  
Keyboard movement： W A S D 

# 4. Conceptual Framework 

This project investigates how multiplayer interaction can transform digital interfaces into shared spatial territories. Instead of focusing on narrative gameplay, the system foregrounds spatial 
relationships between participants. 
Pursuit and evasion become core relational mechanics, while the shared environment functions as a performative field where presence is continuously negotiated. 

The project sits between:

* Multiplayer game design
* Spatial interaction systems
* Post-digital embodiment
* Performative interface design



# 5. Technology 

p5.js
Node.js
Socket.io (real-time multiplayer)
HTML / CSS
JavaScript
Local server networking
Google Maps JavaScript API



### How to Run （local)

1. Clone project

```
git clone https://github.com/Yeri10/Cat_Mice
```

2. Install dependencies

```
npm install
```

3. Start server

```
node app.js
```

4. Open browser

```
http://localhost:3000
```

# 6. API Integration Guide (Real Map Mode)

This section follows a workshop-style API learning flow (like the NASA APOD lab format), but applied to this project.

## Before You Begin: Why API key + CORS matter

In `Real Map` mode, this project loads Google Maps in the browser and uses geolocation.

- The map SDK is fetched from Google's domain.
- Your key controls access and billing.
- Browser origin restrictions (referrer restrictions) can block map loading if not configured correctly.

If configuration is wrong, you may see errors like:

- `InvalidKeyMapError`
- `RefererNotAllowedMapError`
- `Google Maps JavaScript API warning`

## API Key Safety Rules

Treat your Google Maps API key like a password.

- Do not commit real keys into public repositories.
- Do not paste keys into frontend source code.
- Use `.env` for local development.
- Restrict the key in Google Cloud Console by HTTP referrer.

This project already reads key from server-side env and sends it via `/api/client-config`.

## Step 1: Put your key into `.env`

Edit:

`/Users/yerie/Documents/GitHub/Cat_Mice/.env`

Replace placeholder with your real key:

```env
GOOGLE_MAPS_API_KEY=YOUR_REAL_GOOGLE_MAPS_API_KEY
```

Do not keep:

```env
GOOGLE_MAPS_API_KEY=PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE
```

## Step 2: Enable required APIs in Google Cloud

In Google Cloud Console:

1. Enable `Maps JavaScript API`.
2. Ensure billing is active for the project.
3. Set key restrictions:
   - Application restriction: `HTTP referrers (web sites)`
   - Allowed referrers for local dev:
     - `http://localhost:3000/*`
     - `http://127.0.0.1:3000/*`

## Step 3: Restart server after changing `.env`

```bash
npm start
```

Then hard-refresh the browser.

## Step 4: Test Real Map mode

1. Open lobby page.
2. Select `Real Map`.
3. Join seat and start game.
4. Allow browser location permission.

Expected result:

- Google map is shown in full-screen style.
- Your location marker appears.
- Other players with location updates appear as map markers.

## Step 5: Troubleshooting checklist

If map is blank or error card appears:

1. Check `.env` is real key (not placeholder).
2. Confirm server restarted after `.env` update.
3. Check browser console error type.
4. Verify Google Cloud referrer restrictions.
5. Verify `Maps JavaScript API` is enabled.
6. Verify billing is active.

## Quick architecture note (for study)

- Frontend:
  - `public/gps.js`: loads Google Maps SDK, handles geolocation, renders map markers.
  - `public/sketch.js`: mode switch (`Virtual Map` / `Real Map`) and UI flow.
- Backend:
  - `app.js`:
    - Reads `GOOGLE_MAPS_API_KEY` from `.env`.
    - Exposes `/api/client-config`.
    - Receives `geo-pos` socket event and syncs location to room players.

This is the same learning pattern as API lab exercises:

1. Prepare config safely.
2. Request external API.
3. Handle async success/error states.
4. Render dynamic API-driven content.
5. Add fallback and debugging path.


#  Inspiration / Reference

Hanna, W. and Barbera, J. (1940) *Tom and Jerry*. Metro-Goldwyn-Mayer.

This project draws inspiration from the spatial chase dynamics and relational tension between cat and mouse characters, translating animated pursuit structures into a multiplayer interactive spatial system.

