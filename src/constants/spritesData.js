// Starting sprites at ID 80000 to continue the ID sequence

export const SPRITES_DATA = {
  categories: [
    {
      id: 1,
      name: 'Containers',
      order: 0,
      sprites: [
        {
          id: 80001,
          name: 'Box (Closed)',
          order: 0,
          imagePath: '/images/sprites/box_closed.png'
        },
        {
          id: 80002,
          name: 'Box (Opened)',
          order: 1,
          imagePath: '/images/sprites/box_opened.png'
        },
        {
          id: 80003,
          name: 'Chest (Closed)',
          order: 2,
          imagePath: '/images/sprites/chest_closed.png'
        },
        {
          id: 80004,
          name: 'Chest (Opened)',
          order: 3,
          imagePath: '/images/sprites/chest_opened.png'
        }
      ]
    }
  ]
};