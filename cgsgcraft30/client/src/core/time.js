export class Time
{
  constructor()
  {
    this.startTime = performance.now();
    this.lastTime = performance.now();

    this.delta = 0;
    this.elapsed = 0;

    this.fps = 0;
    this._fpsCounter = 0;
    this._fpsTimer = 0;
  }

  update()
  {
    const currentTime = performance.now();

    this.delta = (currentTime - this.lastTime) / 1000;
    this.elapsed = (currentTime - this.startTime) / 1000;

    this.lastTime = currentTime;

    if (this.delta > 0.1)
    {
      this.delta = 0.1;
    }

    this._fpsCounter++;
    this._fpsTimer += this.delta;
    if (this._fpsTimer >= 1.0)
    {
      this.fps = this._fpsCounter;
      this._fpsCounter = 0;
      this._fpsTimer -= 1.0;
    }
  }
}
