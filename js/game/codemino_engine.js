// =========================================================================
// CODEMINO MODULAR GAME ENGINE
// =========================================================================
// Bu dosya, tekil HTML oyun seviyelerinin kütüphane bağımlılıklarını yönetir,
// izometrik çizim motorunu çalıştırır ve Blockly kod yorumlayıcısını yönetir.

(function() {
  // 1. Trusted Types Güvenlik Politikası
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      window.trustedTypes.createPolicy('default', {
        createHTML: (string) => string,
        createScriptURL: (string) => string,
        createScript: (string) => string
      });
    } catch (e) {
      console.warn("TrustedTypes default policy registration bypassed:", e);
    }
  }

  // 2. Dinamik Base URL Çözümleyici
  let CODEMINO_BASE_URL = window.CODEMINO_BASE_URL || (window.parent && window.parent.CODEMINO_BASE_URL) || '';
  if (!CODEMINO_BASE_URL) {
    if (document.currentScript && document.currentScript.src) {
      let scriptSrc = document.currentScript.src;
      let idx = scriptSrc.indexOf('js/');
      if (idx !== -1) {
        CODEMINO_BASE_URL = scriptSrc.substring(0, idx);
      }
    }
    if (!CODEMINO_BASE_URL && window.location.pathname.includes('/codeEditor')) {
      CODEMINO_BASE_URL = '/';
    }
  }
  if (CODEMINO_BASE_URL && !CODEMINO_BASE_URL.endsWith('/')) {
    CODEMINO_BASE_URL += '/';
  }
  window.CODEMINO_BASE_URL = CODEMINO_BASE_URL;
  
  function getAssetUrl(path) {
    if (!CODEMINO_BASE_URL) return path;
    return (CODEMINO_BASE_URL.endsWith('/') || path.startsWith('/') ? CODEMINO_BASE_URL : CODEMINO_BASE_URL + '/') + path;
  }

  // 3. Dinamik Kütüphane Yükleyici
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = getAssetUrl(src);
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Sıralı Yükleme Akışı
  async function loadLibraries() {
    try {
      await loadScript('js/blockly_compressed.js');
      await loadScript('js/blocks_compressed.js');
      await loadScript('js/javascript_compressed.js');
      await loadScript('js/tr.js');
      await loadScript('js/acorn.js');
      await loadScript('js/interpreter.js');
      console.log("All Codemino dependencies loaded sequentially.");
      initGame();
    } catch (e) {
      console.error("Failed to load Codemino libraries:", e);
    }
  }

  // =========================================================================
  // BEYANLAR VE GLOBAL DEĞİŞKENLER
  // =========================================================================
  window.player = null;
  window.destination = null;
  window.startPosition = null;
  window.worldObjects = [];
  window.worldGrid = [];
  window.collectedJewels = 0;
  window.objectSize = 0;

  window.workspace = null;
  window.isRunCode = true;
  window.latestCode = "";
  window.myInterpreter = null;
  window.highlightPause = false;
  window.highlightblockid = "";
  window.hasMoreCode = false;
  window.isCodeRunning = false;
  window.isRestartRequired = false;

  // Ses dosyaları ve Kontrolörleri
  window.audioFootsteps = null;
  window.audioRock = null;
  window.audioCollect = null;
  window.audioVictory = null;
  window.audioSpace = null;

  // Safe Storage
  const SafeStorage = {
    getItem(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    setItem(key, value) {
      try { localStorage.setItem(key, value); } catch (e) {}
    }
  };

  window.isSoundMuted = SafeStorage.getItem("codeminomuted") === "true";
  window.playSpeed = parseInt(SafeStorage.getItem("codeminospeed") || "1");

  function initAudio() {
    window.audioFootsteps = new Audio(getAssetUrl('media/footsteps.mp3'));
    window.audioRock = new Audio(getAssetUrl('media/rock.mp3'));
    window.audioCollect = new Audio(getAssetUrl('media/collect.mp3'));
    window.audioVictory = new Audio(getAssetUrl('media/victory.mp3'));
    window.audioSpace = new Audio(getAssetUrl('media/space.mp3'));
    
    window.audioVictory.volume = 0.15;
    window.audioSpace.volume = 0.20;
    window.audioSpace.loop = true;

    if (!window.isSoundMuted) {
      const startMusic = () => {
        window.audioSpace.play().catch(e => console.log("Music play blocked:", e));
        window.removeEventListener('click', startMusic);
        window.removeEventListener('touchstart', startMusic);
      };
      window.addEventListener('click', startMusic);
      window.addEventListener('touchstart', startMusic);
    }
    updateSoundUI();
  }

  window.playSound = function(audio) {
    if (!window.isSoundMuted && audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log("Sound play blocked:", e));
    }
  };

  window.toggleSound = function() {
    window.isSoundMuted = !window.isSoundMuted;
    SafeStorage.setItem("codeminomuted", window.isSoundMuted ? "true" : "false");
    if (window.isSoundMuted) {
      window.audioSpace.pause();
    } else {
      window.audioSpace.play().catch(e => console.log("Space music failed:", e));
    }
    updateSoundUI();
  };

  function updateSoundUI() {
    const img = document.getElementById("imgSound");
    if (img) img.src = window.isSoundMuted ? getAssetUrl("images/soundoff.png") : getAssetUrl("images/soundon.png");
  }

  window.toggleSpeed = function() {
    window.playSpeed = window.playSpeed === 3 ? 1 : window.playSpeed + 1;
    SafeStorage.setItem("codeminospeed", window.playSpeed.toString());
    updateSpeedUI();
    if (window.gameArea.interval) {
      clearInterval(window.gameArea.interval);
      window.gameArea.interval = setInterval(updateGameArea, 18 / window.playSpeed);
    }
  };

  function updateSpeedUI() {
    const img = document.getElementById("imgSpeed");
    if (img) img.src = getAssetUrl("images/speed" + window.playSpeed + ".png");
  }

  // =========================================================================
  // BLOCKLY BLOK TANIMLAMALARI (BLOCKS & GENERATORS)
  // =========================================================================
  const START_COMMAND = "başla";
  const TURNRIGHT_COMMAND = "sağa dön";
  const TURNLEFT_COMMAND = "sola dön";
  const WALK_COMMAND = "ilerle";
  const SMASHSTONE_COMMAND = "parçala";
  const COLLECTJEWEL_COMMAND = "topla";
  const FOR_COMMAND = "tekrar";

  function defineBlocklyBlocks() {
    Blockly.Blocks['start'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(START_COMMAND)
            .setAlign(Blockly.ALIGN_CENTRE)
            .appendField(new Blockly.FieldImage(getAssetUrl("images/monkey.png"), 28, 28, "*"));
        this.setNextStatement(true);
        this.setColour("#3bd459");
      }
    };
    Blockly.JavaScript['start'] = function(block) {
      return "start();\n";
    };

    Blockly.Blocks['walk'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(WALK_COMMAND)
            .appendField(new Blockly.FieldImage(getAssetUrl("images/walk.png"), 28, 28, ""));
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#3b96ea");
      }
    };
    Blockly.JavaScript['walk'] = function(block) {
      return "Walk();\n";
    };

    Blockly.Blocks['turn_right'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(TURNRIGHT_COMMAND)
            .appendField(new Blockly.FieldImage(getAssetUrl("images/turnright.png"), 28, 28, ""));
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#3b96ea");
      }
    };
    Blockly.JavaScript['turn_right'] = function(block) {
      return "TurnToRight();\n";
    };

    Blockly.Blocks['turn_left'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(TURNLEFT_COMMAND)
            .appendField(new Blockly.FieldImage(getAssetUrl("images/turnleft.png"), 28, 28, ""));
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#3b96ea");
      }
    };
    Blockly.JavaScript['turn_left'] = function(block) {
      return "TurnToLeft();\n";
    };

    Blockly.Blocks['smash_stone'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(SMASHSTONE_COMMAND)
            .appendField(new Blockly.FieldImage(getAssetUrl("images/smash.png"), 28, 28, ""));
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#3b96ea");
      }
    };
    Blockly.JavaScript['smash_stone'] = function(block) {
      return "BreakRock();\n";
    };

    Blockly.Blocks['collect_jewel'] = {
      init: function() {
        this.appendDummyInput()
            .appendField(COLLECTJEWEL_COMMAND)
            .appendField(new Blockly.FieldImage(getAssetUrl("images/jewel.png"), 28, 28, ""));
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#3b96ea");
      }
    };
    Blockly.JavaScript['collect_jewel'] = function(block) {
      return "CollectCrystal();\n";
    };

    Blockly.Blocks['for_dongusu'] = {
      init: function() {
        this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown([["1","1"], ["2","2"], ["3","3"], ["4","4"], ["5","5"]]), "TIMES")
          .appendField(FOR_COMMAND)
          .appendField(new Blockly.FieldImage(getAssetUrl("images/arrows.png"), 28, 28, "loop"));
        this.appendStatementInput("DO").setCheck(null).appendField("");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(120);
      }
    };
    Blockly.JavaScript['for_dongusu'] = function(block) {
      var repeats = String(Number(block.getFieldValue('TIMES') || '1'));
      var branch = Blockly.JavaScript.statementToCode(block, 'DO');
      Blockly.JavaScript.loopCounter = (Blockly.JavaScript.loopCounter || 0) + 1;
      var loopVar = 'count_' + Blockly.JavaScript.loopCounter;
      return 'for (var ' + loopVar + ' = 0; ' + loopVar + ' < ' + repeats + '; ' + loopVar + '++) {\n' +
             branch +
             '}\n';
    };
  }

  function initBlockly() {
    const xmlToolbox = document.getElementById("toolbox");
    const allowed = window.levelConfig.allowedBlocks;
    
    xmlToolbox.innerHTML = '';
    allowed.forEach(type => {
      let blockNode = document.createElement("block");
      blockNode.setAttribute("type", type);
      xmlToolbox.appendChild(blockNode);
    });

    window.workspace = Blockly.inject('blocklyDiv', {
      toolbox: xmlToolbox,
      scrollbars: true,
      trashcan: true,
      zoom: {
        controls: true,
        wheel: false,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.5
      }
    });

    const dom = Blockly.Xml.textToDom(window.levelConfig.workspaceBlocks);
    Blockly.Xml.domToWorkspace(dom, window.workspace);

    window.workspace.addChangeListener(updateBlockCount);
    updateBlockCount();
  }

  function updateBlockCount() {
    let count = window.workspace.getAllBlocks(false).filter(b => b.type !== 'start').length;
    const lbl = document.getElementById("lblCurrentBlocks");
    if (lbl) lbl.innerText = count;
  }

  // =========================================================================
  // INTERPRETER KONTROLLERİ VE API WRAPPERS
  // =========================================================================
  function initInterpreterApi(interpreter, scope) {
    const actions = ["Walk", "TurnToRight", "TurnToLeft", "BreakRock", "CollectCrystal", "start"];
    actions.forEach(action => {
      let wrapper = function() {
        const result = window[action]();
        window.highlightPause = true;
        return result;
      };
      interpreter.setProperty(scope, action, interpreter.createNativeFunction(wrapper));
    });

    let wrapperHighlight = function(id) {
      window.highlightblockid = id;
      if (window.workspace) {
        window.workspace.highlightBlock(id);
      }
    };
    interpreter.setProperty(scope, 'highlightBlock', interpreter.createNativeFunction(wrapperHighlight));

    let wrapperLoopStep = function() {
      // No-op to prevent running ahead of animations
    };
    interpreter.setProperty(scope, 'loopstep', interpreter.createNativeFunction(wrapperLoopStep));

    let wrapperLoopEnd = function() {
      // No-op to prevent running ahead of animations
    };
    interpreter.setProperty(scope, 'loopend', interpreter.createNativeFunction(wrapperLoopEnd));
  }

  function generateCodeAndLoadIntoInterpreter() {
    Blockly.JavaScript.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
    Blockly.JavaScript.addReservedWords('highlightBlock');
    Blockly.JavaScript.loopCounter = 0;
    let startBlock = window.workspace.getBlocksByType('start')[0];
    if (startBlock && startBlock.getNextBlock()) {
      window.latestCode = Blockly.JavaScript.blockToCode(startBlock.getNextBlock());
    } else {
      window.latestCode = "";
    }
    window.workspace.highlightBlock(null);
    window.highlightblockid = "";
    window.highlightPause = false;
  }

  window.StepCode = function() {
    try {
      if (!window.isCodeRunning) return;
      window.workspace.highlightBlock(window.highlightblockid);
      if (window.myInterpreter) {
        window.highlightPause = false;
        let ok = true;
        do {
          try {
            window.hasMoreCode = window.myInterpreter.step();
          } catch (err) {
            console.error(err);
            ok = false;
            if (window.isCodeRunning) {
              window.Unsuccess();
            }
          }
          if (!window.hasMoreCode) {
            window.StateControl();
            return;
          }
        } while (window.hasMoreCode && window.isCodeRunning && !window.highlightPause && ok);
      }
    } catch (err) {
      console.error(err);
      if (window.isCodeRunning) {
        window.Unsuccess();
      }
    }
  };

  window.start = function() {
    if (window.hasMoreCode && window.isCodeRunning) {
      setTimeout(() => { window.StateControl(); window.StepCode(); }, 500);
    }
  };

  window.handleRunClick = function() {
    if (window.isRunCode) {
      window.isRunCode = false;
      const btn = document.getElementById("btRunCode");
      if (btn) btn.classList.add("reset-state");
      document.getElementById("iconRun").style.display = "none";
      document.getElementById("iconReset").style.display = "block";
      
      runInterpreter();
    } else {
      window.isRunCode = true;
      const btn = document.getElementById("btRunCode");
      if (btn) btn.classList.remove("reset-state");
      document.getElementById("iconRun").style.display = "block";
      document.getElementById("iconReset").style.display = "none";
      
      window.restartGame();
    }
  };

  function runInterpreter() {
    try {
      generateCodeAndLoadIntoInterpreter();
      if (window.latestCode.trim().length > 0) {
        if (!window.isCodeRunning && !window.isRestartRequired) {
          window.isCodeRunning = true;
          window.myInterpreter = new Interpreter(window.latestCode, initInterpreterApi);
          window.StepCode();
        }
      } else {
        window.Unsuccess();
      }
    } catch(err) {
      console.error(err);
      window.Unsuccess();
    }
  }

  // =========================================================================
  // OYUN MOTORU SINIFLARI VE ÇİZİM METOTLARI
  // =========================================================================
  class AssetManager {
    constructor() {
      this.successCount = 0;
      this.errorCount = 0;
      this.cache = {};
      this.downloadQueue = [];
    }
    queueDownload(path) {
      this.downloadQueue.push(path);
    }
    downloadAll(callback) {
      if (this.downloadQueue.length === 0) {
        callback();
        return;
      }
      for (let path of this.downloadQueue) {
        let img = new Image();
        img.addEventListener("load", () => {
          this.successCount++;
          if (this.isDone()) callback();
        });
        img.addEventListener("error", () => {
          this.errorCount++;
          if (this.isDone()) callback();
        });
        img.src = path;
        this.cache[path] = img;
      }
    }
    getAsset(path) {
      return this.cache[path];
    }
    isDone() {
      return this.downloadQueue.length === this.successCount + this.errorCount;
    }
  }

  const ASSET_MANAGER = new AssetManager();

  window.gameArea = {
    canvas: document.createElement("canvas"),
    start: function() {
      const wrapper = document.getElementById("divOuterGameArea");
      let width = wrapper.clientWidth - 10;
      let height = width * 2 / 3;

      if (height > wrapper.clientHeight - 10) {
        height = wrapper.clientHeight - 10;
        width = height * 1.5;
      }

      this.canvas.width = width;
      this.canvas.height = height;
      this.squareSizeX = width / 10;
      this.squareSizeY = height / 10;
      this.context = this.canvas.getContext("2d");

      document.getElementById("divGameArea").innerHTML = '';
      document.getElementById("divGameArea").appendChild(this.canvas);

      this.interval = setInterval(updateGameArea, 18 / window.playSpeed);
    },
    clear: function() {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },
    stop: function() {
      clearInterval(this.interval);
    }
  };

  // Isometric translation: i is row (y), j is column (x)
  function getIsoCoords(i, j) {
    let x = 0;
    let y = window.gameArea.canvas.height / 2 - window.gameArea.squareSizeY * 1.3;
    
    for (let k = 0; k < j; k++) {
      x += window.gameArea.squareSizeX / 2;
      y -= window.gameArea.squareSizeY / 2;
    }
    for (let k = 0; k < i; k++) {
      x += window.gameArea.squareSizeX / 2;
      y += window.gameArea.squareSizeY / 2;
    }
    return { x, y };
  }

  class GameObject {
    constructor(width, height, imagePath, x, y) {
      this.width = width;
      this.height = height;
      this.x = x;
      this.y = y;
      this.image = ASSET_MANAGER.getAsset(imagePath) || new Image();
      if (!this.image.src) this.image.src = imagePath;
    }
    update() {
      const ctx = window.gameArea.context;
      ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
  }

  class AnimatedObject extends GameObject {
    constructor(width, height, basePath, x, y, frameCount, frameSeq) {
      super(width, height, basePath + "1.png", x, y);
      this.basePath = basePath;
      this.frameCount = frameCount;
      this.frameSeq = frameSeq || Array.from({length: frameCount}, (_, i) => i + 1);
      this.frameIndex = 0;
      this.delay = 0;
      this.images = [];
      
      for (let i = 0; i < frameCount; i++) {
        let p = basePath + (i + 1) + ".png";
        this.images[i] = ASSET_MANAGER.getAsset(p) || new Image();
        if (!this.images[i].src) this.images[i].src = p;
      }
    }
    animate() {
      this.delay++;
      if (this.delay >= 5) {
        this.delay = 0;
        let activeFrame = this.frameSeq[this.frameIndex];
        this.image = this.images[activeFrame - 1];
        this.frameIndex = (this.frameIndex + 1) % this.frameSeq.length;
      }
    }
  }

  class Player extends GameObject {
    constructor(width, height, x, y) {
      super(width, height, getAssetUrl("images/player/player1.png"), x, y);
      this.matrisX = window.levelConfig.playerPosition.x;
      this.matrisY = window.levelConfig.playerPosition.y;
      this.destX = this.x;
      this.destY = this.y;
      this.destArray = [];
      
      this.direction = window.levelConfig.startDirection;
      this.logicalDirection = window.levelConfig.startDirection;
      this.turnStep = false;
      this.destTaken = false;
      this.isRunning = false;
      this.waitingDelay = 0;
      
      this.normalImages = ["21"];
      this.runningImages = ["1"];
      this.normalIndex = 0;
      this.runningIndex = 0;
      this.animationDelay = 0;

      this.sprites = [];
      for (let i = 0; i < 38; i++) {
        let path = getAssetUrl("images/player/player" + (i + 1) + ".png");
        this.sprites[i] = ASSET_MANAGER.getAsset(path) || new Image();
        if (!this.sprites[i].src) this.sprites[i].src = path;
      }
      this.setDirections();
    }

    setDirections() {
      if (this.direction === "left") {
        this.normalImages = ["25", "25", "25", "25", "25", "25", "25", "25", "25", "25"];
        this.runningImages = ["6"];
      } else if (this.direction === "right") {
        this.normalImages = ["11", "11", "11", "11", "11", "11", "11", "11", "11", "11"];
        this.runningImages = ["11"];
      } else if (this.direction === "down") {
        this.normalImages = ["21", "21", "21", "21", "21", "21", "21", "21", "22", "22", "22", "22"];
        this.runningImages = ["1"];
      } else if (this.direction === "up") {
        this.normalImages = ["16", "16", "16", "16", "16", "16", "16", "16"];
        this.runningImages = ["16"];
      }
      this.normalIndex = 0;
      this.runningIndex = 0;
    }

    newPos() {
      if (this.destArray.length > 0 && !this.destTaken) {
        let destObj = this.destArray.shift();
        if (destObj.type === "turn") {
          this.direction = destObj.direction;
          this.setDirections();
          this.isRunning = false;
          this.destTaken = true;
          this.waitingDelay = 0;
          this.turnStep = true;
        } else {
          this.targetVal = destObj.destination;
          this.direction = destObj.direction;
          this.setDirections();
          this.destTaken = true;
          this.isRunning = true;
          this.turnStep = false;
        }
      }

      if (this.destTaken) {
        if (this.turnStep) {
          this.stopStep(0, 0);
        } else {
          if (this.direction === "right") {
            if (this.x < this.targetVal) {
              this.x += 3;
              this.y -= 2;
            } else {
              this.stopStep(1, 0);
            }
          } else if (this.direction === "left") {
            if (this.x > this.targetVal) {
              this.x -= 3;
              this.y += 2;
            } else {
              this.stopStep(-1, 0);
            }
          } else if (this.direction === "up") {
            if (this.y > this.targetVal) {
              this.x -= 3;
              this.y -= 2;
            } else {
              this.stopStep(0, -1);
            }
          } else if (this.direction === "down") {
            if (this.y < this.targetVal) {
              this.x += 3;
              this.y += 2;
            } else {
              this.stopStep(0, 1);
            }
          }
        }
      }
    }

    stopStep(deltaX, deltaY) {
      this.isRunning = false;
      this.waitingDelay++;
      if (this.waitingDelay >= 20) {
        this.waitingDelay = 0;
        this.matrisX += deltaX;
        this.matrisY += deltaY;
        this.destTaken = false;
        window.StateControl();
        if (window.hasMoreCode && window.isCodeRunning) {
          window.StepCode();
        }
      }
    }

    animate() {
      this.animationDelay++;
      if (this.animationDelay >= 5) {
        this.animationDelay = 0;
        if (this.isRunning) {
          window.playSound(window.audioFootsteps);
          let frame = parseInt(this.runningImages[this.runningIndex]);
          this.image = this.sprites[frame - 1];
          this.runningIndex = (this.runningIndex + 1) % this.runningImages.length;
        } else {
          let frame = parseInt(this.normalImages[this.normalIndex]);
          this.image = this.sprites[frame - 1];
          this.normalIndex = (this.normalIndex + 1) % this.normalImages.length;
        }
      }
    }

    crashWith() {
      let val = window.worldGrid[this.matrisY][this.matrisX];
      return (val === 0 || val === 1 || val === 7 || val === 12 || val === 13 || val === 14 || val > 101);
    }

    reachDestination() {
      return (window.worldGrid[this.matrisY][this.matrisX] === 100) || 
             (window.worldGrid[this.matrisY][this.matrisX] === 6 && this.matrisX === window.levelConfig.destinationPosition.x && this.matrisY === window.levelConfig.destinationPosition.y);
    }

    outOfBorders() {
      return (this.x < -this.width || this.x > window.gameArea.canvas.width || this.y < -this.height || this.y > window.gameArea.canvas.height);
    }
  }

  window.startGame = function() {
    window.isCodeRunning = false;
    window.isRestartRequired = false;
    window.collectedJewels = 0;

    window.worldGrid = window.levelConfig.world.map(row => [...row]);
    window.gameArea.start();

    window.objectSize = window.gameArea.squareSizeX * 0.9;

    let pSize = window.objectSize * 0.75;
    // CORRECT POSITION PLACEMENT BUG (y: row, x: column)
    let startCoords = getIsoCoords(window.levelConfig.playerPosition.y, window.levelConfig.playerPosition.x);
    window.player = new Player(pSize, pSize, startCoords.x + (window.gameArea.squareSizeX - pSize) / 4, startCoords.y - pSize * 0.75);

    window.startPosition = new GameObject(window.objectSize, window.objectSize, getAssetUrl("images/world/world2.png"), startCoords.x, startCoords.y);

    let destCoords = getIsoCoords(window.levelConfig.destinationPosition.y, window.levelConfig.destinationPosition.x);
    window.destination = new AnimatedObject(window.objectSize, window.objectSize, getAssetUrl("images/player/destination"), destCoords.x, destCoords.y, 2, [1,1,1,1,1,1,2,2,2,2,2,2]);

    window.AddGameObjects();
    generateCodeAndLoadIntoInterpreter();
  };

  window.restartGame = function() {
    window.gameArea.stop();
    window.startGame();
  };

  window.AddGameObjects = function() {
    window.worldObjects = [];
    for (let i = 0; i < 10; i++) {
      for (let j = 9; j >= 0; j--) {
        let num = window.worldGrid[i][j];
        if (num > 0 && num < 100) {
          let coords = getIsoCoords(i, j);
          window.worldObjects.push(new GameObject(window.objectSize, window.objectSize, getAssetUrl("images/world/world" + num + ".png"), coords.x, coords.y));
        }
      }
    }
  };

  function updateGameArea() {
    window.gameArea.clear();

    for (let i = 0; i < 10; i++) {
      for (let j = 9; j >= 0; j--) {
        let num = window.worldGrid[i][j];
        let coords = getIsoCoords(i, j);
        
        if (num > 0 && num < 100) {
          let obj = window.worldObjects.find(o => Math.round(o.x) === Math.round(coords.x) && Math.round(o.y) === Math.round(coords.y));
          if (obj) obj.update();
        }
        if (num === 101) {
          window.startPosition.update();
        }
        if (num === 100) {
          window.destination.animate();
          window.destination.update();
        }
      }
    }

    window.player.newPos();
    window.player.animate();
    window.player.update();
  }

  // =========================================================================
  // SEVİYE HAREKET API'LERİ
  // =========================================================================
  window.Walk = function() {
    if (window.player.logicalDirection === "up") {
      window.player.destX -= window.gameArea.squareSizeX / 2;
      window.player.destY -= window.gameArea.squareSizeY / 2;
      window.player.destArray.push({ type: "walk", destination: window.player.destY, direction: "up" });
    } else if (window.player.logicalDirection === "down" || window.player.logicalDirection === "") {
      window.player.destX += window.gameArea.squareSizeX / 2;
      window.player.destY += window.gameArea.squareSizeY / 2;
      window.player.destArray.push({ type: "walk", destination: window.player.destY, direction: "down" });
    } else if (window.player.logicalDirection === "left") {
      window.player.destX -= window.gameArea.squareSizeX / 2;
      window.player.destY += window.gameArea.squareSizeY / 2;
      window.player.destArray.push({ type: "walk", destination: window.player.destX, direction: "left" });
    } else if (window.player.logicalDirection === "right") {
      window.player.destX += window.gameArea.squareSizeX / 2;
      window.player.destY -= window.gameArea.squareSizeY / 2;
      window.player.destArray.push({ type: "walk", destination: window.player.destX, direction: "right" });
    }
  };

  window.TurnToRight = function() {
    const dirs = ["up", "right", "down", "left"];
    let idx = dirs.indexOf(window.player.logicalDirection);
    window.player.logicalDirection = dirs[(idx + 1) % 4];
    window.player.destArray.push({ type: "turn", direction: window.player.logicalDirection });
  };

  window.TurnToLeft = function() {
    const dirs = ["up", "left", "down", "right"];
    let idx = dirs.indexOf(window.player.logicalDirection);
    window.player.logicalDirection = dirs[(idx + 1) % 4];
    window.player.destArray.push({ type: "turn", direction: window.player.logicalDirection });
  };

  window.BreakRock = function() {
    window.playSound(window.audioRock);
    let targetX = window.player.matrisX;
    let targetY = window.player.matrisY;

    if (window.player.logicalDirection === "up") targetY--;
    else if (window.player.logicalDirection === "down" || window.player.logicalDirection === "") targetY++;
    else if (window.player.logicalDirection === "left") targetX--;
    else if (window.player.logicalDirection === "right") targetX++;

    if (window.worldGrid[targetY] && window.worldGrid[targetY][targetX] === 7) {
      window.worldGrid[targetY][targetX] = 8;
      
      let hitFrames = window.player.logicalDirection === "left" ? ["33", "34", "35", "36"] :
                      window.player.logicalDirection === "right" ? ["37", "37", "37", "37"] :
                      window.player.logicalDirection === "up" ? ["38", "38", "38", "38"] : ["29", "30", "31", "32"];
      window.player.normalImages = hitFrames;
      window.player.normalIndex = 0;
    } else {
      window.Unsuccess();
    }

    window.AddGameObjects();
    if (window.hasMoreCode && window.isCodeRunning) {
      setTimeout(() => { window.StateControl(); window.StepCode(); }, 500);
    }
  };

  window.CollectCrystal = function() {
    let val = window.worldGrid[window.player.matrisY][window.player.matrisX];
    if (val === 5) {
      window.playSound(window.audioCollect);
      window.worldGrid[window.player.matrisY][window.player.matrisX] = 4;
      window.collectedJewels++;
    } else if (val === 4) {
      window.playSound(window.audioCollect);
      window.worldGrid[window.player.matrisY][window.player.matrisX] = 3;
      window.collectedJewels++;
    } else if (val === 3) {
      window.playSound(window.audioCollect);
      window.worldGrid[window.player.matrisY][window.player.matrisX] = 6;
      window.collectedJewels++;
    } else {
      window.Unsuccess();
    }

    window.AddGameObjects();
    if (window.hasMoreCode && window.isCodeRunning) {
      setTimeout(() => { window.StateControl(); window.StepCode(); }, 200);
    }
  };

  // =========================================================================
  // SEVİYE BİTİŞ KONTROLÜ (KAZANMA / KAYBETME)
  // =========================================================================
  window.StateControl = function() {
    if (window.player.outOfBorders() || window.player.crashWith()) {
      window.Unsuccess();
    } else if (window.player.reachDestination()) {
      if (window.collectedJewels === window.levelConfig.jewelnumber) {
        window.Successful();
      } else {
        window.Unsuccess();
      }
    } else if (!window.hasMoreCode && !window.player.isRunning && !window.player.destTaken && window.player.destArray.length === 0) {
      window.Unsuccess();
    }
  };

  window.Unsuccess = function() {
    window.isRestartRequired = true;
    window.isCodeRunning = false;
    window.gameArea.stop();
    
    window.isRunCode = true;
    const btn = document.getElementById("btRunCode");
    if (btn) btn.classList.remove("reset-state");
    document.getElementById("iconRun").style.display = "block";
    document.getElementById("iconReset").style.display = "none";
    
    showModal("modalError");
  };

  window.Successful = function() {
    window.isRestartRequired = true;
    window.isCodeRunning = false;
    window.gameArea.stop();

    window.isRunCode = true;
    const btn = document.getElementById("btRunCode");
    if (btn) btn.classList.remove("reset-state");
    document.getElementById("iconRun").style.display = "block";
    document.getElementById("iconReset").style.display = "none";

    window.playSound(window.audioVictory);

    let count = window.workspace.getAllBlocks(false).filter(b => b.type !== 'start').length;
    let score = 1;
    if (window.levelConfig.targetedBlockNumber === 0 || count <= window.levelConfig.targetedBlockNumber) {
      score = 3;
    } else if (count === window.levelConfig.targetedBlockNumber + 1) {
      score = 2;
    }

    document.getElementById("star1").classList.remove("active");
    document.getElementById("star2").classList.remove("active");
    document.getElementById("star3").classList.remove("active");

    showModal("modalSuccess");
    setTimeout(() => {
      if (score >= 1) document.getElementById("star1").classList.add("active");
      if (score >= 2) setTimeout(() => document.getElementById("star2").classList.add("active"), 200);
      if (score === 3) setTimeout(() => document.getElementById("star3").classList.add("active"), 400);
    }, 300);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        codeminoStatus: "success",
        score: score,
        blocksCount: count
      }, "*");
    }
  };

  window.showModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = "flex";
      setTimeout(() => { modal.classList.add("active"); }, 10);
    }
  };

  window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove("active");
      setTimeout(() => { modal.style.display = "none"; }, 300);
    }
  };

  // =========================================================================
  // INITIALIZATION RUNNER
  // =========================================================================
  function updateLevelUI() {
    document.getElementById("lblLevelTitle").innerText = window.levelConfig.title;
    document.getElementById("messageInfoBody").innerHTML = window.levelConfig.description;
    document.getElementById("lblTargetBlocks").innerText = window.levelConfig.targetedBlockNumber;

    // Update level progress indicator if present
    const lblProgress = document.getElementById("lblLevelProgress");
    if (lblProgress && window.levels && Array.isArray(window.levels)) {
      lblProgress.innerText = (window.currentLevelIndex + 1) + "/" + window.levels.length;
    }
  }

  window.initGame = function() {
    updateLevelUI();

    initAudio();
    defineBlocklyBlocks();
    initBlockly();

    for (let i = 1; i <= 38; i++) {
      ASSET_MANAGER.queueDownload(getAssetUrl("images/player/player" + i + ".png"));
    }
    for (let i = 1; i <= 8; i++) {
      ASSET_MANAGER.queueDownload(getAssetUrl("images/world/world" + i + ".png"));
    }
    for (let i = 12; i <= 15; i++) {
      ASSET_MANAGER.queueDownload(getAssetUrl("images/world/world" + i + ".png"));
    }
    ASSET_MANAGER.queueDownload(getAssetUrl("images/player/destination1.png"));
    ASSET_MANAGER.queueDownload(getAssetUrl("images/player/destination2.png"));
    
    ASSET_MANAGER.downloadAll(() => {
      const preloader = document.getElementById("preloader");
      if (preloader) {
        preloader.style.opacity = 0;
        setTimeout(() => { preloader.style.display = "none"; }, 500);
      }
      updateSpeedUI();
      window.startGame();
    });
  };

  // =========================================================================
  // MULTI-LEVEL NAVIGATION (ÇOK SEVİYELİ GEÇİŞ)
  // =========================================================================
  window.goToNextLevel = function() {
    closeModal('modalSuccess');

    // Multi-level support: advance to next level in the levels array
    if (window.levels && Array.isArray(window.levels)) {
      if (window.currentLevelIndex < window.levels.length - 1) {
        window.currentLevelIndex++;
        window.levelConfig = window.levels[window.currentLevelIndex];

        // Stop current game
        window.gameArea.stop();

        // Update UI labels
        updateLevelUI();

        // Rebuild Blockly workspace with new toolbox and initial blocks
        if (window.workspace) {
          window.workspace.dispose();
        }
        initBlockly();

        // Reset run button state
        window.isRunCode = true;
        const btn = document.getElementById("btRunCode");
        if (btn) btn.classList.remove("reset-state");
        document.getElementById("iconRun").style.display = "block";
        document.getElementById("iconReset").style.display = "none";

        // Start the new level
        window.startGame();
      } else {
        // All levels completed
        const completionModal = document.getElementById("modalCompletion");
        if (completionModal) {
          showModal("modalCompletion");
        } else {
          alert("\uD83C\uDF89 Tebrikler! T\u00fcm seviyeleri ba\u015Far\u0131yla tamamlad\u0131n!");
        }
      }
    }
  };

  // Resize handler
  window.addEventListener("resize", () => {
    window.restartGame();
  });

  // Entrypoint loader
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    loadLibraries();
  } else {
    window.addEventListener('DOMContentLoaded', loadLibraries);
  }

})();
