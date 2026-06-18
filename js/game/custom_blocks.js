'use strict';

Blockly.Blocks['start'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(START_COMMAND)
        .setAlign(Blockly.ALIGN_CENTRE)
        .appendField(new Blockly.FieldImage("images/monkey.png", 30, 30, "*"));
    this.setNextStatement(true);
    this.setTooltip("");
    this.setHelpUrl("");
    if (typeof this.setStyle === 'function') {
      this.setStyle('logic_blocks');
    }
    this.setColour("#3bd459");
  }
};

Blockly.Blocks['turn_right'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(TURNRIGHT_COMMAND)
        .appendField(new Blockly.FieldImage("images//turnright.png", 30, 30, ""));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour("#3b96ea");
    this.setTooltip("");
    this.setHelpUrl("");
    if (typeof this.setStyle === 'function') {
      this.setStyle('colour_blocks');
    }
  }
};

Blockly.Blocks['turn_left'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(TURNLEFT_COMMAND)
        .appendField(new Blockly.FieldImage("images//turnleft.png", 30, 30, ""));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour("#3b96ea");
    this.setTooltip("");
    this.setHelpUrl("");
    if (typeof this.setStyle === 'function') {
      this.setStyle('colour_blocks');
    }
  }
};

Blockly.Blocks['walk'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(WALK_COMMAND)
        .appendField(new Blockly.FieldImage("images//walk.png", 30, 30, ""));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour("#3b96ea");
    this.setTooltip("");
    this.setHelpUrl("");
    if (typeof this.setStyle === 'function') {
      this.setStyle('colour_blocks');
    }
  }
};

Blockly.Blocks['smash_stone'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(SMASHSTONE_COMMAND)
        .appendField(new Blockly.FieldImage("images//smash.png", 30, 30, ""));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour("#3b96ea");
    this.setTooltip("");
    this.setHelpUrl("");
    if (typeof this.setStyle === 'function') {
      this.setStyle('colour_blocks');
    }
  }
};

Blockly.Blocks['collect_jewel'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(COLLECTJEWEL_COMMAND)
        .appendField(new Blockly.FieldImage("images//jewel.png", 30, 30, ""));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour("#3b96ea");
    this.setTooltip("");
    this.setHelpUrl("");
    if (typeof this.setStyle === 'function') {
      this.setStyle('colour_blocks');
    }
  }
};

Blockly.Blocks['for_dongusu'] = {
  init: function() {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([["1","1"], ["2","2"], ["3","3"], ["4","4"], ["5","5"]]), "TIMES")
      .appendField(FOR_COMMAND)
      .appendField(new Blockly.FieldImage("images//arrows.png", 30, 30, "down"));
    this.appendStatementInput("DO")
        .setCheck(null)
        .appendField("");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip("");
    this.setHelpUrl("");
    if (typeof this.setStyle === 'function') {
      this.setStyle('loop_blocks');
    }
    this.setColour(Blockly.Msg["LOOPS_HUE"] || 120);
  }
};
