export class ChatConsole
{
  constructor(Multiplayer, Token)
  {
    this.multiplayer = Multiplayer;
    this.token = Token;
    this.root = document.getElementById('chatConsole');
    this.input = document.getElementById('chatInput');
    this.log = document.getElementById('chatLog');
    this.open = false;
    this.history = [];
    this.historyIndex = -1;

    if (this.input)
    {
      this.input.addEventListener('keydown', (Event) => this.onInputKey(Event));
    }
  }

  toggle()
  {
    this.open = !this.open;
    if (this.root)
      this.root.classList.toggle('open', this.open);

    if (this.open && this.input)
    {
      this.input.focus();
      document.exitPointerLock?.();
    }
  }

  appendLine(Text, ClassName = '')
  {
    if (!this.log)
      return;

    const Line = document.createElement('div');
    Line.className = `chat-line ${ClassName}`;
    Line.textContent = Text;
    this.log.appendChild(Line);
    this.log.scrollTop = this.log.scrollHeight;

    while (this.log.children.length > 100)
      this.log.removeChild(this.log.firstChild);
  }

  onInputKey(Event)
  {
    if (Event.key === 'Enter')
    {
      Event.preventDefault();
      const Text = this.input.value.trim();
      if (Text)
      {
        this.history.unshift(Text);
        this.historyIndex = -1;
        this.send(Text);
      }
      this.input.value = '';
      this.toggle();
    }
    else if (Event.key === 'Escape')
    {
      Event.preventDefault();
      this.toggle();
    }
    else if (Event.key === 'ArrowUp')
    {
      Event.preventDefault();
      if (this.historyIndex < this.history.length - 1)
      {
        this.historyIndex++;
        this.input.value = this.history[this.historyIndex];
      }
    }
    else if (Event.key === 'ArrowDown')
    {
      Event.preventDefault();
      if (this.historyIndex > 0)
      {
        this.historyIndex--;
        this.input.value = this.history[this.historyIndex];
      }
      else
      {
        this.historyIndex = -1;
        this.input.value = '';
      }
    }
  }

  send(Text)
  {
    if (Text.startsWith('/'))
    {
      this.multiplayer.sendChatCommand(Text.slice(1), this.token);
      this.appendLine(`> ${Text}`, 'cmd');
    }
    else
    {
      this.multiplayer.sendChatMessage(Text);
      this.appendLine(`Вы: ${Text}`, 'self');
    }
  }

  onMessage(Data)
  {
    if (Data.type === 'system')
      this.appendLine(Data.text, 'system');
    else if (Data.type === 'chat')
      this.appendLine(`${Data.username}: ${Data.text}`, 'chat');
    else if (Data.type === 'command_result')
      this.appendLine(Data.text, Data.ok ? 'system' : 'error');
  }
}
