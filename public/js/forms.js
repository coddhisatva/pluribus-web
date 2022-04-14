/* © Pluribus 2022. */


var forms = {
	/**
	 * Add show/hide password functionality to a password input.
	 * @param {HTMLInputElement} input 
	 */
	addPasswordVisibilityToggle: function(input) {
		var toggle = document.createElement('div');
		toggle.className = 'password-visibility-toggle';
		input.after(toggle);
		input.classList.add('has-password-visibility');

		['eye', 'eye-hidden'].forEach(id => {
			var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.id = 'icon-' + id;
			var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
			use.setAttribute('href', '/images/ui/icons.svg#' + id);
			svg.appendChild(use);
			toggle.appendChild(svg)
		});

		toggle.addEventListener('mousedown', function(e) {
			e.preventDefault();
			e.stopPropagation();
			input.type = input.type == 'password' ? 'text' : 'password';
		});
	}
};

