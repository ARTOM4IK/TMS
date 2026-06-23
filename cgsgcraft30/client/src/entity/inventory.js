export class Inventory
{
  constructor(HotbarSize = 9, Rows = 3, Cols = 9)
  {
    this.hotbarSize = HotbarSize;
    this.rows = Rows;
    this.cols = Cols;
    this.slots = new Array(HotbarSize + Rows * Cols).fill(null);
    this.selectedSlot = 0;
    this.isOpen = false;
    this.maxStack = 64;
  }

  static fromData(Data)
  {
    const Inv = new Inventory();
    if (!Data)
      return Inv;

    if (Array.isArray(Data.slots))
    {
      for (let I = 0; I < Math.min(Data.slots.length, Inv.slots.length); I++)
        Inv.slots[I] = Data.slots[I] ? { ...Data.slots[I] } : null;
    }

    Inv.selectedSlot = typeof Data.selectedSlot === 'number' ? Data.selectedSlot : 0;
    return Inv;
  }

  exportData()
  {
    return {
      slots: this.slots.map(S => S ? { ...S } : null),
      selectedSlot: this.selectedSlot
    };
  }

  getSelectedStack()
  {
    return this.slots[this.selectedSlot];
  }

  getSelectedBlockId()
  {
    const Stack = this.getSelectedStack();
    if (!Stack || Stack.count <= 0)
      return globalThis.Blocks.AIR;
    return Stack.blockId;
  }

  addBlock(blockId, count = 1)
  {
    if (!blockId || blockId === globalThis.Blocks.AIR)
      return false;

    let Remaining = count;

    for (let I = 0; I < this.slots.length && Remaining > 0; I++)
    {
      const Stack = this.slots[I];
      if (Stack && Stack.blockId === blockId && Stack.count < this.maxStack)
      {
        const Add = Math.min(this.maxStack - Stack.count, Remaining);
        Stack.count += Add;
        Remaining -= Add;
      }
    }

    for (let I = 0; I < this.slots.length && Remaining > 0; I++)
    {
      if (!this.slots[I])
      {
        const Add = Math.min(this.maxStack, Remaining);
        this.slots[I] = { blockId, count: Add };
        Remaining -= Add;
      }
    }

    return Remaining < count;
  }

  consumeSelected(count = 1)
  {
    const Stack = this.getSelectedStack();
    if (!Stack || Stack.count < count)
      return false;

    Stack.count -= count;
    if (Stack.count <= 0)
      this.slots[this.selectedSlot] = null;

    return true;
  }

  selectNext()
  {
    this.selectedSlot = (this.selectedSlot + 1) % this.hotbarSize;
  }

  selectPrev()
  {
    this.selectedSlot = (this.selectedSlot - 1 + this.hotbarSize) % this.hotbarSize;
  }

  selectSlot(Index)
  {
    if (Index >= 0 && Index < this.hotbarSize)
      this.selectedSlot = Index;
  }

  seedStarterItems()
  {
    if (this.slots.some(Stack => Stack && Stack.count > 0))
      return;

    const B = globalThis.Blocks;
    const Starter =
    [
      { blockId: B.GRASS, count: 64 },
      { blockId: B.DIRT, count: 64 },
      { blockId: B.STONE, count: 64 },
      { blockId: B.WOOD, count: 32 },
      { blockId: B.PLANKS, count: 32 }
    ];

    for (let I = 0; I < Starter.length && I < this.hotbarSize; I++)
      this.slots[I] = { ...Starter[I] };
  }
}
