import { ControllerState } from '../types/racing';

export interface UnifiedInput {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steer: number; // -1 (left) to +1 (right)
  boost: boolean; // ERS / overtake mode
  switchCamera: boolean;
  reset: boolean;
  pause: boolean;
  isGamepadActive: boolean;
  gamepadName: string | null;
}

class InputManager {
  private keys: Record<string, boolean> = {};
  private cameraJustPressed: boolean = false;
  private resetJustPressed: boolean = false;
  private pauseJustPressed: boolean = false;

  private prevGamepadButtons: Record<number, boolean> = {};
  private activeGamepadIndex: number | null = null;
  private gamepadConnectedToast: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('gamepadconnected', this.handleGamepadConnected);
      window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // If the user is currently typing in an input, textarea, or contentEditable element, allow normal typing including spaces!
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    // Prevent default scrolling for arrows and space during racing
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    this.keys[e.code] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    this.keys[e.code] = false;
  };

  private handleGamepadConnected = (e: GamepadEvent) => {
    this.activeGamepadIndex = e.gamepad.index;
    this.gamepadConnectedToast = e.gamepad.id || 'Controller connected';
    // Trigger test rumble
    this.rumble(0.2, 0.4, 150);
  };

  private handleGamepadDisconnected = (e: GamepadEvent) => {
    if (this.activeGamepadIndex === e.gamepad.index) {
      this.activeGamepadIndex = null;
      this.gamepadConnectedToast = 'Controller disconnected';
    }
  };

  public getGamepadToast(): string | null {
    const msg = this.gamepadConnectedToast;
    this.gamepadConnectedToast = null;
    return msg;
  }

  public rumble(weak: number = 0.3, strong: number = 0.5, durationMs: number = 80) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp && gp.connected && (gp as unknown as { vibrationActuator?: { playEffect: Function } }).vibrationActuator) {
        try {
          (gp as unknown as { vibrationActuator: { playEffect: Function } }).vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude: Math.min(1, Math.max(0, weak)),
            strongMagnitude: Math.min(1, Math.max(0, strong)),
          });
        } catch {
          // Vibration not supported or denied
        }
        break;
      }
    }
  }

  public poll(): UnifiedInput {
    let throttle = 0;
    let brake = 0;
    let steer = 0;
    let boost = false;
    let switchCamera = false;
    let reset = false;
    let pause = false;
    let isGamepadActive = false;
    let gamepadName: string | null = null;

    // 1. Process Keyboard Input
    if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle = 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) brake = 1;
    if (this.keys['Space']) brake = 1;

    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steer += 1;

    if (this.keys['KeyE'] || this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyX']) {
      boost = true;
    }

    if (this.keys['KeyC'] || this.keys['KeyV']) {
      if (!this.cameraJustPressed) {
        switchCamera = true;
        this.cameraJustPressed = true;
      }
    } else {
      this.cameraJustPressed = false;
    }

    if (this.keys['KeyR']) {
      if (!this.resetJustPressed) {
        reset = true;
        this.resetJustPressed = true;
      }
    } else {
      this.resetJustPressed = false;
    }

    if (this.keys['Escape'] || this.keys['KeyP']) {
      if (!this.pauseJustPressed) {
        pause = true;
        this.pauseJustPressed = true;
      }
    } else {
      this.pauseJustPressed = false;
    }

    // 2. Process Gamepad Input (Overrides or blends smoothly)
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;

        gamepadName = gp.id;
        const b = gp.buttons;
        const a = gp.axes;

        // Triggers: button 7 (RT/R2), button 6 (LT/L2)
        const gpThrottle = b[7] ? b[7].value : 0;
        const gpBrake = b[6] ? b[6].value : 0;

        // Stick Steering: Left stick axis 0 (-1 to 1)
        const rawSteer = a[0] || 0;
        const deadzone = 0.08;
        let gpSteer = 0;
        if (Math.abs(rawSteer) > deadzone) {
          const sign = Math.sign(rawSteer);
          const scaled = (Math.abs(rawSteer) - deadzone) / (1 - deadzone);
          // Non-linear curve for sensitive centering and precise control
          gpSteer = sign * Math.pow(scaled, 1.4);
        }

        // Check if gamepad has any active input
        if (gpThrottle > 0.05 || gpBrake > 0.05 || Math.abs(gpSteer) > 0.05 || b[0]?.pressed || b[1]?.pressed || b[3]?.pressed || b[9]?.pressed) {
          isGamepadActive = true;
        }

        if (gpThrottle > throttle) throttle = gpThrottle;
        if (gpBrake > brake) brake = gpBrake;
        if (Math.abs(gpSteer) > Math.abs(steer)) steer = gpSteer;

        // A / Cross (button 0) or RB (button 5) for boost/DRS
        if ((b[0] && b[0].pressed) || (b[5] && b[5].pressed)) {
          boost = true;
        }

        // Y / Triangle (button 3) for camera toggle
        const cameraBtnPressed = b[3] && b[3].pressed;
        if (cameraBtnPressed && !this.prevGamepadButtons[3]) {
          switchCamera = true;
        }
        this.prevGamepadButtons[3] = !!cameraBtnPressed;

        // B / Circle (button 1) or Back/Select (button 8) for reset
        const resetBtnPressed = (b[1] && b[1].pressed) || (b[8] && b[8].pressed);
        if (resetBtnPressed && !this.prevGamepadButtons[1]) {
          reset = true;
        }
        this.prevGamepadButtons[1] = !!resetBtnPressed;

        // Start / Options (button 9) for pause
        const pauseBtnPressed = b[9] && b[9].pressed;
        if (pauseBtnPressed && !this.prevGamepadButtons[9]) {
          pause = true;
        }
        this.prevGamepadButtons[9] = !!pauseBtnPressed;

        break; // Use primary active gamepad
      }
    }

    return {
      throttle: Math.min(1, Math.max(0, throttle)),
      brake: Math.min(1, Math.max(0, brake)),
      steer: Math.min(1, Math.max(-1, steer)),
      boost,
      switchCamera,
      reset,
      pause,
      isGamepadActive,
      gamepadName,
    };
  }

  public getControllerStatus(): ControllerState {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return { connected: false, id: '', throttle: 0, brake: 0, steer: 0, boost: false, switchCamera: false, reset: false, pause: false };
    }
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp && gp.connected) {
        return {
          connected: true,
          id: gp.id,
          throttle: gp.buttons[7]?.value || 0,
          brake: gp.buttons[6]?.value || 0,
          steer: gp.axes[0] || 0,
          boost: !!(gp.buttons[0]?.pressed || gp.buttons[5]?.pressed),
          switchCamera: !!gp.buttons[3]?.pressed,
          reset: !!gp.buttons[1]?.pressed,
          pause: !!gp.buttons[9]?.pressed,
        };
      }
    }
    return { connected: false, id: '', throttle: 0, brake: 0, steer: 0, boost: false, switchCamera: false, reset: false, pause: false };
  }

  public cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    }
  }
}

export const inputManager = new InputManager();
