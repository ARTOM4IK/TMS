export const ENTITY_MODELS =
{
  player:
  {
    parts:
    [
      { id: 'body', offset: [0, 0.9, 0], scale: [0.6, 1.2, 0.3], color: [0.2, 0.45, 0.9, 1], animate: 'bob' },
      { id: 'head', offset: [0, 1.65, 0], scale: [0.45, 0.45, 0.45], color: [0.95, 0.78, 0.62, 1], pitch: true },
      { id: 'armL', offset: [-0.38, 1.0, 0], scale: [0.18, 0.7, 0.18], color: [0.2, 0.45, 0.9, 1], animate: 'swingL' },
      { id: 'armR', offset: [0.38, 1.0, 0], scale: [0.18, 0.7, 0.18], color: [0.2, 0.45, 0.9, 1], animate: 'swingR' },
      { id: 'legL', offset: [-0.15, 0.35, 0], scale: [0.2, 0.7, 0.2], color: [0.15, 0.15, 0.55, 1], animate: 'swingR' },
      { id: 'legR', offset: [0.15, 0.35, 0], scale: [0.2, 0.7, 0.2], color: [0.15, 0.15, 0.55, 1], animate: 'swingL' }
    ]
  },
  pig:
  {
    parts:
    [
      { id: 'body', offset: [0, 0.55, 0], scale: [0.9, 0.55, 0.55], color: [0.95, 0.65, 0.7, 1], animate: 'bob' },
      { id: 'head', offset: [0.55, 0.6, 0], scale: [0.45, 0.45, 0.4], color: [0.95, 0.65, 0.7, 1] },
      { id: 'leg1', offset: [-0.25, 0.15, 0.2], scale: [0.15, 0.3, 0.15], color: [0.85, 0.5, 0.55, 1], animate: 'swingL' },
      { id: 'leg2', offset: [0.25, 0.15, 0.2], scale: [0.15, 0.3, 0.15], color: [0.85, 0.5, 0.55, 1], animate: 'swingR' },
      { id: 'leg3', offset: [-0.25, 0.15, -0.2], scale: [0.15, 0.3, 0.15], color: [0.85, 0.5, 0.55, 1], animate: 'swingR' },
      { id: 'leg4', offset: [0.25, 0.15, -0.2], scale: [0.15, 0.3, 0.15], color: [0.85, 0.5, 0.55, 1], animate: 'swingL' }
    ]
  },
  cow:
  {
    parts:
    [
      { id: 'body', offset: [0, 0.75, 0], scale: [1.0, 0.75, 0.6], color: [0.35, 0.25, 0.15, 1], animate: 'bob' },
      { id: 'head', offset: [0.65, 0.85, 0], scale: [0.4, 0.4, 0.35], color: [0.35, 0.25, 0.15, 1] },
      { id: 'leg1', offset: [-0.3, 0.2, 0.22], scale: [0.16, 0.4, 0.16], color: [0.25, 0.18, 0.12, 1], animate: 'swingL' },
      { id: 'leg2', offset: [0.3, 0.2, 0.22], scale: [0.16, 0.4, 0.16], color: [0.25, 0.18, 0.12, 1], animate: 'swingR' },
      { id: 'leg3', offset: [-0.3, 0.2, -0.22], scale: [0.16, 0.4, 0.16], color: [0.25, 0.18, 0.12, 1], animate: 'swingR' },
      { id: 'leg4', offset: [0.3, 0.2, -0.22], scale: [0.16, 0.4, 0.16], color: [0.25, 0.18, 0.12, 1], animate: 'swingL' }
    ]
  },
  sheep:
  {
    parts:
    [
      { id: 'body', offset: [0, 0.6, 0], scale: [0.75, 0.55, 0.5], color: [0.92, 0.92, 0.92, 1], animate: 'bob' },
      { id: 'head', offset: [0.45, 0.7, 0], scale: [0.32, 0.32, 0.28], color: [0.55, 0.45, 0.4, 1] },
      { id: 'leg1', offset: [-0.22, 0.15, 0.18], scale: [0.12, 0.3, 0.12], color: [0.55, 0.45, 0.4, 1], animate: 'swingL' },
      { id: 'leg2', offset: [0.22, 0.15, 0.18], scale: [0.12, 0.3, 0.12], color: [0.55, 0.45, 0.4, 1], animate: 'swingR' },
      { id: 'leg3', offset: [-0.22, 0.15, -0.18], scale: [0.12, 0.3, 0.12], color: [0.55, 0.45, 0.4, 1], animate: 'swingR' },
      { id: 'leg4', offset: [0.22, 0.15, -0.18], scale: [0.12, 0.3, 0.12], color: [0.55, 0.45, 0.4, 1], animate: 'swingL' }
    ]
  },
  zombie:
  {
    parts:
    [
      { id: 'body', offset: [0, 0.95, 0], scale: [0.55, 1.1, 0.28], color: [0.2, 0.55, 0.25, 1], animate: 'bob' },
      { id: 'head', offset: [0, 1.65, 0], scale: [0.42, 0.42, 0.42], color: [0.25, 0.6, 0.28, 1], pitch: true },
      { id: 'armL', offset: [-0.35, 1.2, 0.1], scale: [0.16, 0.65, 0.16], color: [0.2, 0.55, 0.25, 1], animate: 'zombieArm' },
      { id: 'armR', offset: [0.35, 1.2, 0.1], scale: [0.16, 0.65, 0.16], color: [0.2, 0.55, 0.25, 1], animate: 'zombieArm' },
      { id: 'legL', offset: [-0.14, 0.35, 0], scale: [0.18, 0.7, 0.18], color: [0.15, 0.35, 0.18, 1], animate: 'swingR' },
      { id: 'legR', offset: [0.14, 0.35, 0], scale: [0.18, 0.7, 0.18], color: [0.15, 0.35, 0.18, 1], animate: 'swingL' }
    ]
  },
  chicken:
  {
    parts:
    [
      { id: 'body', offset: [0, 0.35, 0], scale: [0.35, 0.35, 0.45], color: [0.95, 0.95, 0.95, 1], animate: 'bob' },
      { id: 'head', offset: [0.2, 0.5, 0], scale: [0.2, 0.2, 0.2], color: [0.95, 0.95, 0.95, 1] },
      { id: 'beak', offset: [0.32, 0.48, 0], scale: [0.08, 0.06, 0.06], color: [0.95, 0.6, 0.1, 1] },
      { id: 'legL', offset: [-0.08, 0.08, 0], scale: [0.05, 0.16, 0.05], color: [0.95, 0.6, 0.1, 1], animate: 'swingL' },
      { id: 'legR', offset: [0.08, 0.08, 0], scale: [0.05, 0.16, 0.05], color: [0.95, 0.6, 0.1, 1], animate: 'swingR' }
    ]
  },
  creeper:
  {
    parts:
    [
      { id: 'body', offset: [0, 0.75, 0], scale: [0.45, 0.75, 0.28], color: [0.2, 0.75, 0.2, 1], animate: 'bob' },
      { id: 'head', offset: [0, 1.35, 0], scale: [0.45, 0.45, 0.45], color: [0.2, 0.75, 0.2, 1] },
      { id: 'leg1', offset: [-0.15, 0.15, 0.12], scale: [0.14, 0.3, 0.14], color: [0.15, 0.55, 0.15, 1], animate: 'swingL' },
      { id: 'leg2', offset: [0.15, 0.15, 0.12], scale: [0.14, 0.3, 0.14], color: [0.15, 0.55, 0.15, 1], animate: 'swingR' },
      { id: 'leg3', offset: [-0.15, 0.15, -0.12], scale: [0.14, 0.3, 0.14], color: [0.15, 0.55, 0.15, 1], animate: 'swingR' },
      { id: 'leg4', offset: [0.15, 0.15, -0.12], scale: [0.14, 0.3, 0.14], color: [0.15, 0.55, 0.15, 1], animate: 'swingL' }
    ]
  },
  smazlivy_hrysh:
  {
    parts:
    [
      { id: 'body', offset: [0, 0.5, 0], scale: [0.5, 0.35, 0.7], color: [0.55, 0.35, 0.2, 1], animate: 'wiggle' },
      { id: 'head', offset: [0, 0.55, 0.45], scale: [0.35, 0.28, 0.35], color: [0.6, 0.4, 0.25, 1], animate: 'wiggle' },
      { id: 'earL', offset: [-0.12, 0.72, 0.45], scale: [0.08, 0.12, 0.04], color: [0.45, 0.28, 0.15, 1] },
      { id: 'earR', offset: [0.12, 0.72, 0.45], scale: [0.08, 0.12, 0.04], color: [0.45, 0.28, 0.15, 1] },
      { id: 'tail', offset: [0, 0.45, -0.45], scale: [0.08, 0.08, 0.25], color: [0.5, 0.32, 0.18, 1], animate: 'wiggle' },
      { id: 'leg1', offset: [-0.18, 0.12, 0.2], scale: [0.08, 0.24, 0.08], color: [0.4, 0.25, 0.12, 1], animate: 'swingL' },
      { id: 'leg2', offset: [0.18, 0.12, 0.2], scale: [0.08, 0.24, 0.08], color: [0.4, 0.25, 0.12, 1], animate: 'swingR' },
      { id: 'leg3', offset: [-0.18, 0.12, -0.2], scale: [0.08, 0.24, 0.08], color: [0.4, 0.25, 0.12, 1], animate: 'swingR' },
      { id: 'leg4', offset: [0.18, 0.12, -0.2], scale: [0.08, 0.24, 0.08], color: [0.4, 0.25, 0.12, 1], animate: 'swingL' }
    ]
  }
};

export function getAnimOffset(AnimType, Phase)
{
  switch (AnimType)
  {
    case 'bob': return Math.sin(Phase) * 0.03;
    case 'swingL': return Math.sin(Phase) * 0.25;
    case 'swingR': return Math.sin(Phase + Math.PI) * 0.25;
    case 'zombieArm': return -0.8 + Math.sin(Phase * 0.5) * 0.1;
    case 'wiggle': return Math.sin(Phase * 4) * 0.08;
    default: return 0;
  }
}

export function getModel(ModelId)
{
  return ENTITY_MODELS[ModelId] || ENTITY_MODELS.player;
}
