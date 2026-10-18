import { ControllerState } from '../types/racing';

export interface UnifiedInput {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steer: number; // -1 (left) to +1 (right)
  boost: boolean; // ERS / overtake mode
  switchCamera: boolean;
  reset: boolean;
  pause: boolean;
  orderBlock: boolean; // 1: Tell teammate to block pack
  orderYield: boolean; // 2: Tell teammate to yield position
  orderPush: boolean; // 3: Tell teammate to push pace
  orderNeutral: boolean; // 4: Free racing
  isGamepadActive: boolean;
  gamepadName: string | null;
}

export interface CustomControlBindings {
  throttle: string[];
  brake: string[];
  steerLeft: string[];
  steerRight: string[];
  boost: string[];
  drs: string[];
  switchCamera: string[];
  reset: string[];
  pause: string[];
  orderBlock: string[];
  orderYield: string[];
  orderPush: string[];
  orderNeutral: string[];
}

export interface CustomGamepadBindings {
  throttleButton: number; // default 7 (RT/R2)
  brakeButton: number; // default 6 (LT/L2)
  boostButton: number; // default 0 (A / Cross)
  drsButton: number; // default 5 (RB / R1)
  switchCameraButton: number; // default 3 (Y / Triangle)
  resetButton: number; // default 1 (B / Circle)
  pauseButton: number; // default 9 (Start / Options)
  orderBlockButton: number; // default 14 (D-Pad Left)
  orderYieldButton: number; // default 13 (D-Pad Down)
  orderPushButton: number; // default 15 (D-Pad Right)
  orderNeutralButton: number; // default 12 (D-Pad Up)
}

export const DEFAULT_KEY_BINDINGS: CustomControlBindings = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown', 'Space'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
  boost: ['KeyE', 'ShiftLeft', 'ShiftRight', 'KeyX'],
  drs: ['KeyF', 'KeyZ'],
  switchCamera: ['KeyC', 'KeyV'],
  reset: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  orderBlock: ['Digit1', 'Numpad1', '1'],
  orderYield: ['Digit2', 'Numpad2', '2'],
  orderPush: ['Digit3', 'Numpad3', '3'],
  orderNeutral: ['Digit4', 'Numpad4', '4'],
};

export const DEFAULT_GAMEPAD_BINDINGS: CustomGamepadBindings = {
  throttleButton: 7, // RT
  brakeButton: 6, // LT
  boostButton: 0, // A
  drsButton: 5, // RB
  switchCameraButton: 3, // Y
  resetButton: 1, // B
  pauseButton: 9, // Start
  orderBlockButton: 14, // D-Pad Left
  orderYieldButton: 13, // D-Pad Down
  orderPushButton: 15, // D-Pad Right
  orderNeutralButton: 12, // D-Pad Up
};

const STORAGE_KEY_CONTROLS = 'apex26_custom_button_mapping_v2';
const STORAGE_KEY_GAMEPAD = 'apex26_custom_gamepad_mapping_v2';

class InputManager {
  private keys: Record<string, boolean> = {};
  private keyBindings: CustomControlBindings = { ...DEFAULT_KEY_BINDINGS };
  private gamepadBindings: CustomGamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS };

  private cameraJustPressed: boolean = false;
  private resetJustPressed: boolean = false;
  private pauseJustPressed: boolean = false;
  private orderBlockJustPressed: boolean = false;
  private orderYieldJustPressed: boolean = false;
  private orderPushJustPressed: boolean = false;
  private orderNeutralJustPressed: boolean = false;

  private prevGamepadButtons: Record<number, boolean> = {};
  private activeGamepadIndex: number | null = null;
  private gamepadConnectedToast: string | null = null;

  private listeningAction: keyof CustomControlBindings | null = null;
  private onKeyCapturedCallback: ((action: keyof CustomControlBindings, key: string) => void) | null = null;

  constructor() {
    this.loadBindings();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('gamepadconnected', this.handleGamepadConnected);
      window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
      window.addEventListener('blur', this.handleWindowBlur);
    }
  }

  public loadBindings() {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTROLS);
      if (saved) {
        this.keyBindings = { ...DEFAULT_KEY_BINDINGS, ...JSON.parse(saved) };
      }
      const savedGp = localStorage.getItem(STORAGE_KEY_GAMEPAD);
      if (savedGp) {
        this.gamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS, ...JSON.parse(savedGp) };
      }
    } catch {
      this.keyBindings = { ...DEFAULT_KEY_BINDINGS };
      this.gamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS };
    }
  }

  public saveBindings() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_CONTROLS, JSON.stringify(this.keyBindings));
      localStorage.setItem(STORAGE_KEY_GAMEPAD, JSON.stringify(this.gamepadBindings));
    } catch {
      // Storage error
    }
  }

  public getKeyBindings(): CustomControlBindings {
    return { ...this.keyBindings };
  }

  public getGamepadBindings(): CustomGamepadBindings {
    return { ...this.gamepadBindings };
  }

  public setKeyBinding(action: keyof CustomControlBindings, newKeys: string[]) {
    this.keyBindings[action] = newKeys;
    this.saveBindings();
  }

  public setKeyBindings(bindings: CustomControlBindings) {
    this.keyBindings = { ...bindings };
    this.saveBindings();
  }

  public setGamepadBinding(action: keyof CustomGamepadBindings, btnIndex: number) {
    this.gamepadBindings[action] = btnIndex;
    this.saveBindings();
  }

  public setGamepadBindings(bindings: CustomGamepadBindings) {
    this.gamepadBindings = { ...bindings };
    this.saveBindings();
  }

  public getUnifiedInput(): UnifiedInput {
    return this.poll();
  }

  public resetToDefaults() {
    this.keyBindings = { ...DEFAULT_KEY_BINDINGS };
    this.gamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS };
    this.saveBindings();
  }

  public startCapturingKey(action: keyof CustomControlBindings, callback: (action: keyof CustomControlBindings, key: string) => void) {
    this.listeningAction = action;
    this.onKeyCapturedCallback = callback;
  }

  public stopCapturingKey() {
    this.listeningAction = null;
    this.onKeyCapturedCallback = null;
  }

  private setKeyState(codeOrKey: string, val: boolean) {
    if (!codeOrKey) return;
    this.keys[codeOrKey] = val;
    this.keys[codeOrKey.toLowerCase()] = val;
    this.keys[codeOrKey.toUpperCase()] = val;
    if (codeOrKey.startsWith('Key')) {
      const letter = codeOrKey.slice(3);
      this.keys[letter] = val;
      this.keys[letter.toLowerCase()] = val;
      this.keys[letter.toUpperCase()] = val;
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // If we are currently capturing a custom button rebind:
    if (this.listeningAction && this.onKeyCapturedCallback) {
      e.preventDefault();
      const code = e.code || e.key;
      const action = this.listeningAction;
      this.keyBindings[action] = [code];
      this.saveBindings();
      this.onKeyCapturedCallback(action, code);
      this.listeningAction = null;
      this.onKeyCapturedCallback = null;
      return;
    }

    // If the user is currently typing in an input, textarea, or contentEditable element, allow normal typing including spaces!
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    // Prevent default scrolling for arrows and space during racing
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code) this.setKeyState(e.code, true);
    if (e.key) this.setKeyState(e.key, true);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (e.code) this.setKeyState(e.code, false);
    if (e.key) this.setKeyState(e.key, false);
  };

  public clearAllKeys() {
    this.keys = {};
  }

  private handleWindowBlur = () => {
    this.clearAllKeys();
  };

  private handleGamepadConnected = (e: GamepadEvent) => {
    this.activeGamepadIndex = e.gamepad.index;
    this.gamepadConnectedToast = e.gamepad.id || 'Controller connected';
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

  private isActionPressed(action: keyof CustomControlBindings): boolean {
    const boundKeys = this.keyBindings[action] || [];
    return boundKeys.some((k) => {
      if (!k) return false;
      if (this.keys[k] || this.keys[k.toLowerCase()] || this.keys[k.toUpperCase()]) return true;
      if (k.startsWith('Key')) {
        const letter = k.slice(3);
        if (this.keys[letter] || this.keys[letter.toLowerCase()] || this.keys[letter.toUpperCase()]) return true;
      }
      return false;
    });
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

    let orderBlock = false;
    let orderYield = false;
    let orderPush = false;
    let orderNeutral = false;

    // 1. Process Keyboard Input with Custom Control Mapping
    if (this.isActionPressed('throttle')) throttle = 1;
    if (this.isActionPressed('brake')) brake = 1;

    if (this.isActionPressed('steerLeft')) steer -= 1;
    if (this.isActionPressed('steerRight')) steer += 1;

    if (this.isActionPressed('boost') || this.isActionPressed('drs')) {
      boost = true;
    }

    if (this.isActionPressed('switchCamera')) {
      if (!this.cameraJustPressed) {
        switchCamera = true;
        this.cameraJustPressed = true;
      }
    } else {
      this.cameraJustPressed = false;
    }

    if (this.isActionPressed('reset')) {
      if (!this.resetJustPressed) {
        reset = true;
        this.resetJustPressed = true;
      }
    } else {
      this.resetJustPressed = false;
    }

    if (this.isActionPressed('pause')) {
      if (!this.pauseJustPressed) {
        pause = true;
        this.pauseJustPressed = true;
      }
    } else {
      this.pauseJustPressed = false;
    }

    // Teammate Radio Orders: 1 = Block Pack, 2 = Yield Position, 3 = Push Pace, 4 = Free Racing
    if (this.isActionPressed('orderBlock')) {
      if (!this.orderBlockJustPressed) {
        orderBlock = true;
        this.orderBlockJustPressed = true;
      }
    } else {
      this.orderBlockJustPressed = false;
    }

    if (this.isActionPressed('orderYield')) {
      if (!this.orderYieldJustPressed) {
        orderYield = true;
        this.orderYieldJustPressed = true;
      }
    } else {
      this.orderYieldJustPressed = false;
    }

    if (this.isActionPressed('orderPush')) {
      if (!this.orderPushJustPressed) {
        orderPush = true;
        this.orderPushJustPressed = true;
      }
    } else {
      this.orderPushJustPressed = false;
    }

    if (this.isActionPressed('orderNeutral')) {
      if (!this.orderNeutralJustPressed) {
        orderNeutral = true;
        this.orderNeutralJustPressed = true;
      }
    } else {
      this.orderNeutralJustPressed = false;
    }

    // 2. Process Gamepad Input with Custom Control Mapping
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;

        gamepadName = gp.id;
        const b = gp.buttons;
        const a = gp.axes;

        const thBtn = this.gamepadBindings.throttleButton;
        const brBtn = this.gamepadBindings.brakeButton;
        const gpThrottle = b[thBtn] ? b[thBtn].value : 0;
        const gpBrake = b[brBtn] ? b[brBtn].value : 0;

        // Stick Steering: Left stick axis 0 (-1 to 1)
        const rawSteer = a[0] || 0;
        const deadzone = 0.08;
        let gpSteer = 0;
        if (Math.abs(rawSteer) > deadzone) {
          const sign = Math.sign(rawSteer);
          const scaled = (Math.abs(rawSteer) - deadzone) / (1 - deadzone);
          gpSteer = sign * Math.pow(scaled, 1.4);
        }

        // Check if gamepad has any active input
        if (
          gpThrottle > 0.05 ||
          gpBrake > 0.05 ||
          Math.abs(gpSteer) > 0.05 ||
          b[this.gamepadBindings.boostButton]?.pressed ||
          b[this.gamepadBindings.resetButton]?.pressed ||
          b[this.gamepadBindings.switchCameraButton]?.pressed ||
          b[this.gamepadBindings.pauseButton]?.pressed ||
          b[this.gamepadBindings.orderBlockButton]?.pressed ||
          b[this.gamepadBindings.orderYieldButton]?.pressed ||
          b[this.gamepadBindings.orderPushButton]?.pressed ||
          b[this.gamepadBindings.orderNeutralButton]?.pressed
        ) {
          isGamepadActive = true;
        }

        if (gpThrottle > throttle) throttle = gpThrottle;
        if (gpBrake > brake) brake = gpBrake;
        if (Math.abs(gpSteer) > Math.abs(steer)) steer = gpSteer;

        // Custom Boost / DRS button
        if (
          (b[this.gamepadBindings.boostButton] && b[this.gamepadBindings.boostButton].pressed) ||
          (b[this.gamepadBindings.drsButton] && b[this.gamepadBindings.drsButton].pressed)
        ) {
          boost = true;
        }

        // Custom Camera button
        const cameraBtnPressed = b[this.gamepadBindings.switchCameraButton] && b[this.gamepadBindings.switchCameraButton].pressed;
        if (cameraBtnPressed && !this.prevGamepadButtons[this.gamepadBindings.switchCameraButton]) {
          switchCamera = true;
        }
        this.prevGamepadButtons[this.gamepadBindings.switchCameraButton] = !!cameraBtnPressed;

        // Custom Reset button
        const resetBtnPressed = b[this.gamepadBindings.resetButton] && b[this.gamepadBindings.resetButton].pressed;
        if (resetBtnPressed && !this.prevGamepadButtons[this.gamepadBindings.resetButton]) {
          reset = true;
        }
        this.prevGamepadButtons[this.gamepadBindings.resetButton] = !!resetBtnPressed;

        // Custom Pause button
        const pauseBtnPressed = b[this.gamepadBindings.pauseButton] && b[this.gamepadBindings.pauseButton].pressed;
        if (pauseBtnPressed && !this.prevGamepadButtons[this.gamepadBindings.pauseButton]) {
          pause = true;
        }
        this.prevGamepadButtons[this.gamepadBindings.pauseButton] = !!pauseBtnPressed;

        // Gamepad Teammate Orders (D-Pad or custom buttons)
        const obBtn = this.gamepadBindings.orderBlockButton;
        if (b[obBtn] && b[obBtn].pressed && !this.prevGamepadButtons[obBtn]) {
          orderBlock = true;
        }
        this.prevGamepadButtons[obBtn] = !!(b[obBtn] && b[obBtn].pressed);

        const oyBtn = this.gamepadBindings.orderYieldButton;
        if (b[oyBtn] && b[oyBtn].pressed && !this.prevGamepadButtons[oyBtn]) {
          orderYield = true;
        }
        this.prevGamepadButtons[oyBtn] = !!(b[oyBtn] && b[oyBtn].pressed);

        const opBtn = this.gamepadBindings.orderPushButton;
        if (b[opBtn] && b[opBtn].pressed && !this.prevGamepadButtons[opBtn]) {
          orderPush = true;
        }
        this.prevGamepadButtons[opBtn] = !!(b[opBtn] && b[opBtn].pressed);

        const onBtn = this.gamepadBindings.orderNeutralButton;
        if (b[onBtn] && b[onBtn].pressed && !this.prevGamepadButtons[onBtn]) {
          orderNeutral = true;
        }
        this.prevGamepadButtons[onBtn] = !!(b[onBtn] && b[onBtn].pressed);

        break;
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
      orderBlock,
      orderYield,
      orderPush,
      orderNeutral,
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
        const thBtn = this.gamepadBindings.throttleButton;
        const brBtn = this.gamepadBindings.brakeButton;
        return {
          connected: true,
          id: gp.id,
          throttle: gp.buttons[thBtn]?.value || 0,
          brake: gp.buttons[brBtn]?.value || 0,
          steer: gp.axes[0] || 0,
          boost: !!(gp.buttons[this.gamepadBindings.boostButton]?.pressed || gp.buttons[this.gamepadBindings.drsButton]?.pressed),
          switchCamera: !!gp.buttons[this.gamepadBindings.switchCameraButton]?.pressed,
          reset: !!gp.buttons[this.gamepadBindings.resetButton]?.pressed,
          pause: !!gp.buttons[this.gamepadBindings.pauseButton]?.pressed,
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
