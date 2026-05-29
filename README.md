# Critical Charge ⚡

<img src="public/favicon.png" alt="Critical Charge Game" width="100">

Welcome to **Critical Charge** - a high-speed endless runner game where your device's battery level determines your speed and physics! The lower your battery, the faster you go and the higher you jump, creating a thrilling challenge that gets harder as you play.

## 🎮 How to Play

### **Objective**

Survive as long as possible by dodging enemy chargers on a futuristic track. Your score increases based on how far you travel, and the game gets faster and more frantic as your battery drains!

### **Controls**

Critical Charge supports multiple input methods for both desktop and mobile devices:

#### **Keyboard Controls (Desktop)**

* **← Left Arrow / A**: Move left
* **→ Right Arrow / D**: Move right
* **↑ Up Arrow / W**: Jump over obstacles
* **P / ESC**: Pause game

#### **Touch Controls (Mobile)**

* **Swipe Left**: Move left
* **Swipe Right**: Move right
* **Swipe Up**: Jump
* **Tap Anywhere Else**: Resume (when game over/paused)

#### **Gyroscope Controls (Mobile)**

* **Tilt Left**: Move left
* **Tilt Right**: Move right

### **Gameplay Features**

#### **Core Mechanics**

* **Battery-Powered Speed**: Your device's actual battery level controls your speed! The lower your battery, the faster the track scrolls (up to 8x speed at 0% battery).
* **Dynamic Gravity Physics**: Your jump weight is tied directly to your battery. Full batteries make your character heavy with tight jumps. Low batteries grant massive hang-time to survive the extreme speeds.
* **Three-Lane Movement**: Seamlessly glide between left, center, and right lanes.
* **Endless Track**: The game generates an infinite track with procedurally managed enemy chargers.

#### **Dynamic Audio & Haptics**

* **Multi-Tiered Soundtrack**: The background music automatically shifts to more intense tracks as your battery hits critical thresholds.
* **Dynamic Pitch Scaling**: The game speed dictates the music tempo, and your battery weight dynamically alters the pitch of your jump sound effects!
* **Physical Feedback**: Feel every movement with integrated hardware haptics for lane changes, jumps, heavy crash impacts, and UI taps.
* **Persistent Mute**: Audio settings are saved globally; if you mute the game, it stays muted across sessions.

#### **Scoring System**

* **Score**: Earn points based on distance traveled. Higher speeds earn more points per second.
* **High Score**: Your best score is saved automatically and displayed on the game over screen.

#### **Save & Load**

* **Auto-Save**: The game automatically saves your progress when you pause.
* **Manual Load**: Click the **LOAD GAME** button to continue from your last save.

#### **Visuals**

* **Futuristic Aesthetics**: Neon-lit track with glowing, perspective-scaled edges and sci-fi visual effects.
* **Dynamic HUD**: Displays your score, high score, battery percentage, and current velocity.

## 🔋 Battery Mechanics

The game uses your device's **real battery status** through the Battery Status API to manipulate the game engine:

* **100% - 75% Battery**: Heavy gravity, short jumps, slow track speed (1x).
* **75% - 50% Battery**: Medium gravity, moderate jumps, medium speed.
* **50% - 25% Battery**: Light gravity, high jumps, fast speed.
* **25% - 0% Battery**: Ultra-light gravity, maximum hang-time, extreme speed (8x).

> ⚠️ **Note**: The Battery Status API is only supported on Chromium-based browsers (Chrome, Edge, Opera) on Android, Windows, and macOS. If you're using an unsupported browser (like Safari or Firefox), you'll see a "HARDWARE UNSUPPORTED" screen.

## 🦠 W.I.R.U.S. Anti-Cheat System

Critical Charge requires you to play *off the charger*. Attempting to plug in your device mid-game will trigger the **W.I.R.U.S. Security Protocol**:

* **System Hijacked (Level 1 Penalty)**: Plugging in your device halts the game, stops the music and blares warning sirens
* **System Corrupted (Level 2 Penalty)**: Plugging the charger (3+ times) triggers a catastrophic failure, putting the game into a permanent blackout loop and **wiping all local data** (including high scores and settings).

## 🕹️ Game Screens

### **Main Gameplay**

* **Player**: Your dynamic character running along the track
* **Obstacles**: Enemy chargers that spawn across different lanes
* **Track**: Infinite scrolling road with dynamic scaling neon stripes
* **HUD**: Shows score, high score, battery %, and velocity

### **Pause Screen**

Shows "CRITICAL BREAK" with dynamic options:

* **RESUME**: Continue your current game
* **RESTART**: Immediately restart a fresh run
* **SAVE GAME**: Manually save your state
* **LOAD GAME**: Load your last saved game
* **NEXT TRACK**: Manually override the BGM
* **MUTE / UNMUTE**: Toggle persistent audio
* **TOGGLE CONTROLS**: Swap between Swipe and Tilt modes (if gyroscope is detected)
* **TEST MODE / EXIT TEST**: Enter or leave the developer sandbox

### **Game Over Screen**

Shows "CRITICAL FAILURE" with your final score, high score, and options to Restart or Load Game.

## 🧪 Developer Mode

Critical Charge includes a built-in sandbox for testing mechanics on unsupported devices.

* **Access**: Press the **` (Backtick)** key globally, or click **TEST LAB** in the Pause Menu.
* **Mock Battery**: Use keyboard shortcuts to spoof battery drain (1%/sec), fake a charger connection, or hard-reset to 100%.
* **Live Debugger**: View real-time output of frame rates, BGM/SFX tracks, haptic triggers, raw input matrices, and source API connections.

## 💾 Save System

Critical Charge features a robust save system:

* **State Preservation**: Saves your exact position, score, and the exact location of all active enemies on the track.
* **Manual Loading**: Click **LOAD GAME** to seamlessly resume your game state.

## 🛠️ Technical Requirements

### **Supported Platforms**

* **Desktop**: Chrome, Edge, Opera (Windows/macOS)
* **Mobile**: Chrome, Edge (Android)

### **Unsupported Platforms**

* iOS devices (Safari)
* Firefox browsers
* Any browser without Battery Status API support

## 🎯 Tips & Strategies

1. **Adapt to the Gravity**: A jump at 100% battery feels vastly different than a jump at 10%. Anticipate your hang-time!
2. **Obstacle Timing**: Watch for enemy chargers appearing in the distance and plan your lane changes early.
3. **Jump Clearance**: Time your jumps carefully - you need to be at least 120 pixels high to clear an enemy charger.
4. **Save Often**: Pause frequently to save your progress, especially when you're doing well.
5. **Gyroscope Advantage**: On mobile, use the tilt controls for smooth, threshold-based lane changes.

## 🚀 Getting Started

1. Open the game in a **Chromium-based browser** (Chrome, Edge, Opera)
2. Allow battery status permissions if prompted
3. Use your preferred controls to start playing
4. Avoid the chargers and survive as long as possible!

## 🏗️ Under the Hood (Architecture)

Critical Charge uses a highly modular, vanilla JavaScript engine structure:

* `engine.js`: The central loop and director.
* `player.js`: Encapsulated player state, sprite mathematics, and physics reactions.
* `physics.js`: Centralized collision detection and batch-processing.
* `obstacle-manager.js`: Spawning algorithms and object pooling for enemies.
* `audio.js` & `haptics.js`: Unified media controllers for multi-tier feedback.
* `screens.js`: Centralized canvas button registry mapping touch events mathematically to scaled resolutions.

## 📜 License

This game is open-source and available for personal use and modification.

---

**⚡ Enjoy the game and challenge your friends to beat your high score! ⚡**
