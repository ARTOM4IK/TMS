export class Input
{
  constructor(canvas)
  {
    this.canvas = canvas;

    this.keys = {};
    this.keysClick = {};
    this.mouseButtons = {};
    this.mouseButtonsClick = {};
    this.mouseX = 0;
    this.mouseY = 0;

    // Храним координаты прошлого кадра для точного расчета дельты
    this.prevMouseX = 0;
    this.prevMouseY = 0;

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;

    // Активируем захват курсора при клике по экрану
    document.addEventListener('click', () =>
    {
      document.body.requestPointerLock();
    });

    // Сохраняем ссылки на функции, чтобы потом их можно было удалить (исправление утечки памяти)
    this._onKeyDown = (e) =>
    {
        const key = e.key.toLowerCase();
        this.keys[key] = true;
        this.keysClick[key] = true;

        if (e.ctrlKey || e.metaKey)
        {
          const blockedKeys = ['s', 'd', 'a', 'w', 'p', 'g', 'f'];

          if (blockedKeys.includes(key))
          {
            e.preventDefault();
          }
        }
        if (e.repeat)
          this.keysClick[key] = false;

    }
    this._onKeyUp = (e) =>
    {
        const key = e.key.toLowerCase();
        this.keys[key] = false;
    }
    this._onMouseDown = (e) =>
    {
      this.mouseButtons[e.button] = true;
      this.mouseButtonsClick[e.button] = true;
      if (e.repeat)
        this.mouseButtonsClick[e.button] = false;
    }
    this._onMouseUp = (e) =>
    {
      this.mouseButtons[e.button] = false;
      this.mouseButtonsClick[e.button] = false;
    }
    this._onMouseMove = (e) =>
    {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;

      // Если активен Pointer Lock (FPS камера), используем movementX
      if (document.pointerLockElement === document.body)
      {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    };

    this._onWheel = (e) =>
    {
      this.wheelDelta += e.deltaY;
    };

    // Если окно потеряло фокус — сбрасываем всё, чтобы избежать залипания
    this._onWindowBlur = () =>
    {
      this.keys = {};
      this.mouseButtons = {};
    };

    // Регистрируем события
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('blur', this._onWindowBlur);

    this._onContextMenu = (e) => e.preventDefault();
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  isKeyDown(code)
  {
    return !!this.keys[code];
  }

  isMouseButtonDown(button)
  {
    return !!this.mouseButtons[button];
  }

  /**
   * Вызывать строго в НАЧАЛЕ игрового цикла кадра (прямо перед обработкой логики)
   */
  update()
  {
    // Если Pointer Lock выключен, считаем дельту классическим способом математики кадра
    if (document.pointerLockElement !== document.body)
    {
      this.mouseDeltaX = this.mouseX - this.prevMouseX;
      this.mouseDeltaY = this.mouseY - this.prevMouseY;
    }

    // Сохраняем текущую позицию как старую для следующего кадра
    this.prevMouseX = this.mouseX;
    this.prevMouseY = this.mouseY;
  }

  /**
   * Вызывать строго в самом КОНЦЕ игрового цикла кадра
   */
  postUpdate()
  {
    // Очищаем накопительные дельты, которые зависят от событий мыши
    if (document.pointerLockElement === document.body)
    {
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    }
    this.wheelDelta = 0;
    this.mouseButtonsClick = {};
  }

  /**
   * Полностью очищает слушатели событий при удалении инпута (для предотвращения утечек памяти)
   */
  destroy()
  {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onWindowBlur);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
  }
}
