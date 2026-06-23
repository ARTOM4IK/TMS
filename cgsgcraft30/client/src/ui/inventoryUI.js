import { getBlockName } from '../world/blocks.js';

const BLOCK_COLORS =
{
  584: '#7a7a7a',
  548: '#dbc88a',
  294: '#5b8a3c',
  426: '#6b4a2e',
  425: '#3a7a28',
  664: '#3366cc',
  243: '#8b6914',
  38: '#222222'
};

export function getBlockColor(blockId)
{
  if (BLOCK_COLORS[blockId])
    return BLOCK_COLORS[blockId];

  const Hue = (blockId * 47) % 360;
  return `hsl(${Hue}, 45%, 45%)`;
}
export class InventoryUI
{
  constructor(Player)
  {
    this.player = Player;
    this.root = document.getElementById('inventoryPanel');
    this.hotbar = document.getElementById('hotbar');
    this.mainGrid = document.getElementById('inventoryMain');
    this.hotbarSlots = [];
    this.mainSlots = [];
    this.build();
  }

  createSlot(Index, Container)
  {
    const Slot = document.createElement('div');
    Slot.className = 'mc-slot';
    Slot.dataset.slot = String(Index);

    const Icon = document.createElement('div');
    Icon.className = 'mc-slot-icon';

    const Count = document.createElement('span');
    Count.className = 'mc-slot-count';

    Slot.appendChild(Icon);
    Slot.appendChild(Count);
    Container.appendChild(Slot);

    return { root: Slot, icon: Icon, count: Count };
  }

  build()
  {
    if (this.hotbar)
    {
      this.hotbar.innerHTML = '';
      this.hotbarSlots = [];
      for (let I = 0; I < this.player.inventory.hotbarSize; I++)
        this.hotbarSlots.push(this.createSlot(I, this.hotbar));
    }

    if (this.mainGrid)
    {
      this.mainGrid.innerHTML = '';
      this.mainSlots = [];
      for (let I = this.player.inventory.hotbarSize; I < this.player.inventory.slots.length; I++)
        this.mainSlots.push(this.createSlot(I, this.mainGrid));
    }
  }

  toggle()
  {
    this.player.inventory.isOpen = !this.player.inventory.isOpen;

    if (this.root)
      this.root.classList.toggle('open', this.player.inventory.isOpen);

    if (this.player.inventory.isOpen)
      document.exitPointerLock?.();
  }

  updateSlot(UiSlot, Stack, Selected)
  {
    UiSlot.root.classList.toggle('selected', Selected);

    if (Stack && Stack.count > 0)
    {
      UiSlot.icon.style.backgroundColor = getBlockColor(Stack.blockId);
      UiSlot.icon.style.opacity = '1';
      UiSlot.count.textContent = Stack.count > 1 ? String(Stack.count) : '';
      UiSlot.root.title = `${getBlockName(Stack.blockId)} x${Stack.count}`;
    }
    else
    {
      UiSlot.icon.style.backgroundColor = 'transparent';
      UiSlot.icon.style.opacity = '0';
      UiSlot.count.textContent = '';
      UiSlot.root.title = '';
    }  }

  update()
  {
    const Inv = this.player.inventory;

    for (let I = 0; I < this.hotbarSlots.length; I++)
      this.updateSlot(this.hotbarSlots[I], Inv.slots[I], I === Inv.selectedSlot && !Inv.isOpen);

    for (const Entry of this.mainSlots)
    {
      const Index = Number(Entry.root.dataset.slot);
      this.updateSlot(Entry, Inv.slots[Index], false);
    }

    if (Inv.isOpen && this.hotbarSlots[Inv.selectedSlot])
      this.hotbarSlots[Inv.selectedSlot].root.classList.add('selected');
  }
}
