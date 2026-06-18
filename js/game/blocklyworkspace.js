// Enforce geras renderer
var workspace;
var startXmlDom;
var startXmlText;
	/* TODO: Change toolbox XML ID if necessary. Can export toolbox XML from Workspace Factory. */
$(document).ready(function() {
	var toolbox = document.getElementById("toolbox");

	var options = { 
		  collapse : true, 
		  comments : true, 
		  disable : true, 
		  maxBlocks : Infinity, 
		  trashcan : true, 
		  horizontalLayout : false, 
		  toolboxPosition : 'start', 
		  renderer : 'geras', 
		  css : true, 
		  media : 'https://blockly-demo.appspot.com/static/media/', 
		  rtl : false, 
		  scrollbars : true, 
		  sounds : true, 
		  oneBasedIndex : true, 
		  move: {
		          scrollbars: true,
		          drag: true,
		          wheel: true,
		        },
		  toolbox: toolbox,
		  toolboxOptions: {
		      color: true,
		      inverted: true
		    },
		  zoom : {
		    controls: true,
		    wheel: false,
		    startScale: 1.0,
		    maxScale: 4,
		    minScale: 0.25,
		    scaleSpeed: 1.1
		  }
		};

	/* Inject your workspace */ 
	workspace = Blockly.inject('blocklyDiv', options);
	if (Blockly.Themes && Blockly.Themes.Classic) {
	  Blockly.setTheme(Blockly.Themes.Classic);
	}

	/* Load Workspace Blocks from XML to workspace. Remove all code below if no blocks to load */

	/* TODO: Change workspace blocks XML ID if necessary. Can export workspace blocks XML from Workspace Factory. */


	let pagepart = String(window.location).split("?")[1];
	var dom = Blockly.Xml.textToDom(eval("level" + pagepart));


	Blockly.Xml.domToWorkspace(dom, workspace);

	var workspaceBlocks = document.getElementById("workspaceBlocks"); 
	//workspace.toolbox_.flyout_.autoClose = false;

	/* Load blocks to workspace. */
	Blockly.Xml.domToWorkspace(workspaceBlocks, workspace);

	startXmlDom = Blockly.Xml.workspaceToDom(workspace);
	startXmlText = Blockly.Xml.domToText(startXmlDom);

	workspace.addChangeListener(change);

	if (typeof isAssetsLoaded !== 'undefined' && isAssetsLoaded) {
	  generateCodeAndLoadIntoInterpreter();
	}
});

function change() {
    var xmlDom = Blockly.Xml.workspaceToDom(workspace);
    var xmlText = Blockly.Xml.domToText(xmlDom);

    var startID = findCodeminoStartID(xmlText);

    if(startID != "")
    {
	    var block = workspace.getBlockById(startID);

	    if(block.childBlocks_ != null && block.type == "start")
        {
           latestCode = Blockly.JavaScript.blockToCode(block.childBlocks_[0]);
        }
	}

    if (startXmlText != xmlText) {
      window.location.hash = '';


    }

    workspaceCode = xmlText;
}

function findCodeminoStartID(xml) {

	var startIndex = xml.indexOf('<block type="start" id="');
	var id = "";

	if(startIndex >= 0)
	{
		startIndex = startIndex + 24;

		var tmp = xml.substring(startIndex);

		var endIndex = tmp.indexOf('"');

		id = tmp.substring(0, endIndex);
	}

	return id;
}