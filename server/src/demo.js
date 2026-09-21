export const demoFigmaFile = {
  name: 'Orbit Banking — Mobile App',
  lastModified: '2026-09-20T09:30:00Z',
  version: 'demo-v1',
  document: {
    id: '0:0', type: 'DOCUMENT', name: 'Document', children: [
      {
        id: '1:1', type: 'CANVAS', name: 'Mobile screens', children: [
          {
            id: '2:1', type: 'FRAME', name: 'Welcome screen', fills: [{ type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.12 } }], children: [
              { id: '3:1', type: 'TEXT', name: 'Hero title', characters: 'Banking that moves with you', style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 40, lineHeightPx: 48 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }] },
              { id: '3:2', type: 'TEXT', name: 'Body copy', characters: 'Save, spend, and grow your money from one beautifully simple app.', style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, lineHeightPx: 24 }, fills: [{ type: 'SOLID', color: { r: 0.71, g: 0.74, b: 0.82 } }] },
              { id: '3:3', type: 'COMPONENT', name: 'Primary button', children: [{ id: '3:4', type: 'TEXT', name: 'CTA', characters: 'Create free account', style: { fontFamily: 'Inter', fontWeight: 600, fontSize: 15, lineHeightPx: 20 }, fills: [{ type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.12 } }] }] },
            ],
          },
          {
            id: '2:2', type: 'FRAME', name: 'Dashboard', children: [
              { id: '4:1', type: 'TEXT', name: 'Eyebrow', characters: 'TOTAL BALANCE', style: { fontFamily: 'Inter', fontWeight: 600, fontSize: 12, lineHeightPx: 16 }, fills: [{ type: 'SOLID', color: { r: 0.38, g: 0.4, b: 0.48 } }] },
              { id: '4:2', type: 'TEXT', name: 'Balance', characters: '$24,680.50', style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 32, lineHeightPx: 40 }, fills: [{ type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.12 } }] },
              { id: '4:3', type: 'INSTANCE', name: 'Transaction card', children: [{ id: '4:4', type: 'TEXT', name: 'Label', characters: 'Recent transactions', style: { fontFamily: 'Inter', fontWeight: 600, fontSize: 18, lineHeightPx: 24 }, fills: [{ type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.12 } }] }] },
            ],
          },
        ],
      },
      {
        id: '1:2', type: 'CANVAS', name: 'Web landing page', children: [
          { id: '5:1', type: 'FRAME', name: 'Pricing section', children: [
            { id: '5:2', type: 'TEXT', name: 'Section heading', characters: 'Simple, transparent pricing', style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 32, lineHeightPx: 40 }, fills: [{ type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.12 } }] },
            { id: '5:3', type: 'TEXT', name: 'Body copy', characters: 'Start free. Upgrade when you need more.', style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, lineHeightPx: 24 }, fills: [{ type: 'SOLID', color: { r: 0.38, g: 0.4, b: 0.48 } }] },
          ] },
        ],
      },
    ],
  },
}
