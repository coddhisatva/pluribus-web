/*
© Pluribus 2024

Used to wire up multi-section forms with inline editing
on each section and partial updates via server API calls.

*/

const up = {
	wire: function(container, model, saveUrl, functions) {
		var views = container.querySelectorAll('[view]');

		views.forEach(function(view) {
			var edit = view.nextElementSibling;
			if(!edit || edit.getAttribute('edit') == null) {
				edit = null; // No edit view
			}

			if(edit) {
				// Hook up editing
				var editBtn = view.querySelector('[edit-btn]');
				if(editBtn) {
					editBtn.addEventListener('click', function(e) {
						e.preventDefault();
						edit.style.display = 'block';
						view.style.display = 'none';
						up.setFormValues(edit, model);
					});
				};

				function showView() {
					edit.style.display = 'none';
					view.style.display = 'block';
					return view;
				}
				edit.showView = showView;

				var saveBtn = edit.querySelector('[save-btn]');
				if(saveBtn) {
					saveBtn.originalInnerText = saveBtn.innerText;
					saveBtn.addEventListener('click', function(e) {
						e.preventDefault();
						up.saveFormValues(edit, model, saveUrl,
							function() {
								// Start saving
								// TODO: UI to show saving.
								saveBtn.innerText = 'Saving...';
								saveBtn.disabled = true;
								cancelBtn.style.display = 'none';
							},
							function(data, err) {
								// Finish saving
								saveBtn.innerText = saveBtn.originalInnerText;
								saveBtn.disabled = false;
								cancelBtn.style.display = '';
								if(err) {
									alert('Error saving form!' + err);
								} else {
									for(var prop in data) {
										model[prop] = data[prop];
									}
									view.update();
								}
								showView();
							});
					});
				}

				var cancelBtn = edit.querySelector('[cancel-btn]');
				if(cancelBtn) {
					cancelBtn.addEventListener('click', function(e) {
						e.preventDefault();
						showView();
					})
				}
			}

			// Foreach
			var foreachElements = view.querySelectorAll('[foreach]');
			const reForeach = /^([a-zA-Z0-9_]+)\s*in\s*(.*)/;
			// Hide each master foreach element; only need to do this once.
			foreachElements.forEach(function(foreachElement) {
				foreachElement.originalStyle = foreachElement.getAttribute('style');
				foreachElement.style.display = 'none';
			});
			view.doForeach = function() {
				foreachElements.forEach(function(foreachElement) {
					if(foreachElement.getAttribute('if')) {
						throw "It's an error to use 'if' attribute on an element with a 'foreach' attribute; you should use the 'if' on a wrapper element instead: " + foreachElement.outerHTML;
					}

					// Remove previously generated elements
					if(foreachElement.generated) {
						foreachElement.generated.forEach(function(itemElement) {
							itemElement.remove();
						});
					}

					var foreach = foreachElement.getAttribute('foreach');
					var generated = [];

					var match = reForeach.exec(foreach);
					if(!match) {
						throw 'Invalid foreach expression: ' + foreach;
					}

					var itemModelName = match[1];
					var iterateExpression = match[2];

					var iterateResult = up.eval(model, functions, iterateExpression);
					// Assumes an array, might need to handle iterable or iterator protocol
					for(var i = 0; i < iterateResult.length; i++) {
						// When iterating we need the named item available as well as the original model
						var itemModel = { model: model };
						itemModel[itemModelName] = iterateResult[i]; // add the named iterable item

						var itemElement = foreachElement.cloneNode(true); // deep clone
						itemElement.removeAttribute('id'); // don't duplicate ids
						itemElement.removeAttribute('foreach');

						// itemElement will have copied display:none from foreachElement.
						// Reset the styles to whatever the declared style was
						if(foreachElement.originalStyle) {
							itemElement.setAttribute('style', foreachElement.originalStyle);
						} else {
							itemElement.removeAttribute('style');
						}

						itemElement.itemModel = itemModel;

						// Modify child elements itemElement too, e.g. they may have bind and conditionals that
						// should use the itemModel instead of main model
						function traverseChildrenAndSetItemModel(parent) {
							for(var j = 0; j < parent.children.length; j++) {
								var itemChild = parent.children[j];
								itemChild.itemModel = itemModel;
								traverseChildrenAndSetItemModel(itemChild);
							}
						}
						traverseChildrenAndSetItemModel(itemElement);
						

						// Insert each new item before the master element which
						// makes it easier to put them in the right order if they were inserted
						// after the master element.
						foreachElement.insertAdjacentElement('beforebegin', itemElement);

						generated.push(itemElement);
					}

					foreachElement.generated = generated;
				});
			};

			// Model bindings
			const reBindAttribute = /^(\w+):/;
			view.bind = function() {
				// Elements may have been created by foreach, so we need to query for them again
				var boundElements = view.querySelectorAll('[bind]');

				boundElements.forEach(function(boundElement) {
					// Don't bind the master element with a 'foreach' attribute, each child will be bound instead.
					if(boundElement.getAttribute('foreach')) return;
					if(boundElement.closest('[foreach]')) return;

					// Can have multiple bindings, comma separated.
					// E.g. <a bind="text,href:link"></a> will bind the innerText to text and the href to link.
					var bindings = boundElement.getAttribute('bind').split(',');

					bindings.forEach(function(bind) {
						// Bind is to innerText by default, but can also be to a specified attribute of the element
						// e.b. bind="src:imagePath" will bind the src attribute
						var bindAttribute = reBindAttribute.exec(bind);
						if(bindAttribute) {
							bindAttribute = bindAttribute[1];
							bind = bind.replace(reBindAttribute, '');
						}

						var bindModel = model; // Use the main model by default
						if(boundElement.itemModel) { // If this is a foreach element.
							bindModel = boundElement.itemModel;
						}

						var result;
						try {
							result = up.eval(bindModel, functions, bind);
						} catch(e) {
							throw 'Error evaluating bind="' + bind + '": ' + e;
						}
						
						if(bindAttribute) {
							boundElement.setAttribute(bindAttribute, result);
						} else {
							boundElement.innerHTML = result;
						}
					});

					
					
				});
			};

			// Conditionals
			const conditionTypes = ['if','else-if','else'];
			var conditionalSelector = '[' + conditionTypes.join('],[') + ']';
			view.doConditionals = function() {
				// Elements may have been created by a foreach since declaration, so we need to query for
				// them again.
				var conditionalElements = view.querySelectorAll(conditionalSelector);

				conditionalElements.forEach(function(conditionalElement) {
					var conditionType = null;
					var condition = null;
					for(var i in conditionTypes) {
						condition = conditionalElement.getAttribute(conditionTypes[i]); // will be empty string for else
						if(condition != null) {
							conditionType = conditionTypes[i];
							break;
						}
					}
					
					var visible;
					if(conditionType == 'if') {
						visible = up.evalCondition(model, functions, condition, conditionType);
					} else if(conditionType == 'else-if') {
						var prevElement = conditionalElement.previousElementSibling;
						if(!prevElement.hasAttribute('if')) {
							throw 'Conditional else-if element without an if';
						}
						visible = prevElement.style.display == 'none' && up.evalCondition(model, condition, conditionType);
					} else if(conditionType == 'else') {
						var prevElement = conditionalElement.previousElementSibling;
						if(!prevElement.hasAttribute('if') && !prevElement.hasAttribute('else-if')) {
							throw 'Conditional else element without an if or else-if';
						}
						visible = prevElement.style.display == 'none';
					}

					conditionalElement.style.display = visible ? '' : 'none';
				});
			};

			view.update = function() {
				view.dispatchEvent(new Event('beforeupdate'));

				view.doForeach();
				view.bind();
				view.doConditionals();
			};
		});

		container.update = function() {
			container.dispatchEvent(new Event('beforeupdate'));

			views.forEach(function(view) {
				view.update();
			});
		}

		container.update();
		
	},

	/** Basic lexer function that differentiates between strings and code. */
	lex: function(code) {
		var blockStart = 0;
		var blockType = 'code';

		var blocks = []

		const stringTypes = {
			'"': 'dquote-string',
			"'": 'squote-string',
			'`': 'backtick-string'
		}

		for(var i  = 0; i < code.length; i++) {
			var c = code[i];

			for(var stringStartChar in stringTypes) {
				if(c == stringStartChar) {
					var stringType = stringTypes[stringStartChar];
					if(blockType == stringType && i > 0 && code[i-1] != '\\') {
						// end block
						blocks.push([blockType, code.substring(blockStart, i+1)]);
						blockType = 'code';
						blockStart = i+1;
					} else {
						// start block
						blocks.push([blockType, code.substring(blockStart, i)]);
						blockType = stringType;
						blockStart = i;
					}
				}
			}
		}

		// remaining code block
		if(blockStart < code.length) {
			if(blockType != 'code') {
				throw 'Unterminated string starting at position ' + blockStart + ': ' + code;
			}
	
			blocks.push([blockType, code.substring(blockStart, code.length)]);
		}
		

		return blocks;
	},

	eval: function(model, functions, code) {
		// Convert all identifiers to model.identifier for security
		const allowedKeywords = [ 'if', 'else', 'var', 'let', 'const', 'undefined', 'null' ];
		// Note: Safari can't do positive lookbehind assertions
		const reIdentifier = /(^|[\s\(])([\w$_][^\s\.\[\()]*)/g;

		var blocks = up.lex(code);
		var safeCode = '';
		blocks.forEach(function(block) {
			var type = block[0];
			var text = block[1];

			if(type == 'code') {
				safeCode += text.replace(reIdentifier, function(match, g1, g2, offset) {
					if(allowedKeywords.indexOf(g2) != -1) { return g1 + g2 }
					var functionCall = text.substring(offset + match.length, offset + match.length + 1) == '(';
					if(functionCall) { 
						return g1 + 'functions.' + g2;
					}
					return g1 + 'model.' + g2;
				});
			} else {
				safeCode += text;
			}
		})
		
		return Function('model', 'functions', 'return ' + safeCode)(model, functions);
	},

	// Helper functions
	evalCondition: function(model, functions, condition, conditionType) {
		try {
			return up.eval(model, functions, condition);
		} catch(e) {
			throw 'Error evaluating ' + conditionType + '="' + condition + '": ' + e;
		}
	},

	setFormValues: function(edit, model) {
		var inputs = edit.querySelectorAll('input,textarea');
		inputs.forEach(function(input) {
			if(input.hasAttribute('name')) {
				var name = input.getAttribute('name');
				if(model.hasOwnProperty(name)) {
					input.value = model[name];
				} else {
					input.value = '';
				}
			}
		});
	},

	saveFormValues: function(edit, model, saveUrl, savingCb, savedCb) {
		var data = new FormData();
		var updated = { };
		var inputs = edit.querySelectorAll('input,textarea');
		inputs.forEach(function(input) {
			if(input.hasAttribute('name')) {
				var name = input.getAttribute('name');
				if(input.type == 'file') {
					data.append(name, input.files[0]);
				} else {
					data.append(name, input.value);
				}
				
				updated[name] = input.value; // Save for updating the model if request succeeds
			}
		});

		savingCb();
		fetch(saveUrl, { method: 'post', body: data })
			.then(function(response) {
				if(response.ok) {
					return response.json();
				}
			}).then(function(sync) {
				for(var prop in updated) {
					model[prop] = updated[prop];
				}
				for(var prop in sync) {
					model[prop] = sync[prop];
				}
				savedCb();
			});
	},
}