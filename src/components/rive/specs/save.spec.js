/**
 * Croww Rive Specification: Save Property Bookmark
 * 
 * Target file: save.riv
 * Artboard: SaveBookmark
 * State Machine: SaveSM
 */

export const SAVE_RIVE_SPEC = {
    fileName: 'save.riv',
    artboard: 'SaveBookmark',
    stateMachine: 'SaveSM',
    inputs: {
        isSaved: { name: 'isSaved', type: 'boolean', defaultValue: false },
        onPress: { name: 'onPress', type: 'trigger' },
    },
    states: ['idle', 'unsaved', 'pressed', 'saved'],
    events: ['onSaveToggled', 'onSaveAnimationFinished'],
    consumers: ['SaveButton.js', 'PropertyResultCard.js', 'ListingScreen.js'],
};
