/*
© Pluribus 2022

Used to wire up multi-section forms with inline editing
on each section and partial updates via server API calls.

*/

const up = {
	wire: function(container, model, saveUrl) {
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

			// Model bindings
			var boundElements = view.querySelectorAll('[bind]');
			const reBindAttribute = /^(\w+):/;
			view.bind = function() {
				boundElements.forEach(function(boundElement) {
					var bind = boundElement.getAttribute('bind');
					var bindAttribute = reBindAttribute.exec(bind);
					if(bindAttribute) {
						bindAttribute = bindAttribute[1];
						bind = bind.replace(reBindAttribute, '');
					}
					var result;
					try {
						result = up.eval(model, bind);
					} catch(e) {
						throw 'Error evaluating bind="' + bind + '": ' + e;
					}
					
					if(bindAttribute) {
						boundElement.setAttribute(bindAttribute, result);
					} else {
						boundElement.innerHTML = result;
					}
					
				});
			};

			// Conditionals
			const conditionTypes = ['if','else-if','else'];
			var conditionalSelector = '[' + conditionTypes.join('],[') + ']';
			var conditionalElements = view.querySelectorAll(conditionalSelector);
			view.doConditionals = function() {
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
						visible = up.evalCondition(model, condition, conditionType);
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
				view.bind();
				view.doConditionals();
			};
		});

		container.update = function() {
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
		if(blockStart < code.length - 1) {
			if(blockType != 'code') {
				throw 'Unterminated string starting at position ' + blockStart + ': ' + code;
			}
	
			blocks.push([blockType, code.substring(blockStart, code.length)]);
		}
		

		return blocks;
	},

	eval: function(model, code) {
		// Convert all identifiers to model.identifier for security
		const allowedKeywords = [ 'if', 'else', 'var', 'let', 'const' ];
		// Note: Safari can't do positive lookbehind assertions
		const reIdentifier = /(^|\s)([\w$_][^\s\.\[\()]*)/g;

		var blocks = up.lex(code);
		var safeCode = '';
		blocks.forEach(function(block) {
			var type = block[0];
			var text = block[1];

			if(type == 'code') {
				safeCode += text.replace(reIdentifier, function(match, g1, g2) {
					if(allowedKeywords.indexOf(g2) != -1) { return g1 + g2 }
					return g1 + 'model.' + g2;
				});
			} else {
				safeCode += text;
			}
		})
		
		return Function('model', 'return ' + safeCode)(model);
	},

	// Helper functions
	evalCondition: function(model, condition, conditionType) {
		try {
			return up.eval(model, condition);
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


// Polyfills (don't know if this is needed)
if(!Array.prototype.forEach) {
	Array.prototype.forEach = function(callback) {
		for(var i = 0; i < this.length; i++) {
			callback(this[i], i, this);
		}
	}
}