import { ITEMS_DATA } from '../constants/itemsData.js';
import { SPRITES_DATA } from '../constants/spritesData.js';

export class GameDataService {
  constructor() {
    // Simple service for items and sprites only
  }

  // Items management
  getAllItemCategories() {
    return ITEMS_DATA.categories.sort((a, b) => a.order - b.order);
  }

  getItemsForCategory(categoryId) {
    const category = ITEMS_DATA.categories.find(c => c.id === categoryId);
    return category ? category.items.sort((a, b) => a.order - b.order) : [];
  }

  getItemById(itemId) {
    for (const category of ITEMS_DATA.categories) {
      const item = category.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return null;
  }

  // Sprites management
  getAllSpriteCategories() {
    return SPRITES_DATA.categories.sort((a, b) => a.order - b.order);
  }

  getSpritesForCategory(categoryId) {
    const category = SPRITES_DATA.categories.find(c => c.id === categoryId);
    return category ? category.sprites.sort((a, b) => a.order - b.order) : [];
  }

  getSpriteById(spriteId) {
    for (const category of SPRITES_DATA.categories) {
      const sprite = category.sprites.find(s => s.id === spriteId);
      if (sprite) return sprite;
    }
    return null;
  }
}