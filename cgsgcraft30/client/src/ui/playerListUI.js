export class PlayerListUI
{
  constructor()
  {
    this.root = document.getElementById('playerList');
    this.list = document.getElementById('playerListNames');
    this.visible = false;
  }

  show(Names)
  {
    this.visible = true;
    if (this.root)
      this.root.classList.add('open');

    if (this.list)
    {
      this.list.innerHTML = '';
      for (const Name of Names)
      {
        const Item = document.createElement('div');
        Item.className = 'player-list-item';
        Item.textContent = Name;
        this.list.appendChild(Item);
      }
    }
  }

  hide()
  {
    this.visible = false;
    if (this.root)
      this.root.classList.remove('open');
  }
}
