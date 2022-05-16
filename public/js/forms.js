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
	},

	addDynamicPasswordValidation: function(form, passwordInput) {
		var passwordInput = document.getElementById('password');
		var passwordDynamicFeedback = document.getElementById('passwordDynamicFeedback');
		var feedbackLowercase = document.getElementById('feedbackLowercase');
		var feedbackUppercase = document.getElementById('feedbackUppercase');
		var feedback8Chars = document.getElementById('feedback8Chars');
		var passwordValid = false;

		passwordInput.addEventListener('input', function() {
			var value = passwordInput.value;

			var hasLower = /[[a-z]/.test(value);
			var hasUpper = /[[A-Z]/.test(value);
			var has8Chars = value.length >= 8;

			feedbackLowercase.classList.toggle('text-success', hasLower);
			feedbackUppercase.classList.toggle('text-success', hasUpper);
			feedback8Chars.classList.toggle('text-success', has8Chars);

			passwordValid = hasLower && hasUpper && has8Chars;

			passwordInput.classList.toggle('is-invalid', !passwordValid);
			passwordInput.classList.toggle('is-valid', passwordValid);
		});

		form.addEventListener('submit', function(e) {
			if(!form.checkValidity()) {
				e.stopPropagation();
				e.preventDefault();
			}
			form.classList.add('was-validated');
		});
	},

	hookUpServerValidationErrors: function() {
		var errors = document.querySelectorAll('.server-validation-error');
		errors.forEach(function(errorDiv, index) {
			errorDiv.classList.add('invalid-feedback');
			var inputId = errorDiv.getAttribute('for')
			var input = document.getElementById(inputId);
			input.classList.add('is-invalid');
			if(index == 0) {
				input.focus();
			}
		});
	}
};

forms.hookUpServerValidationErrors();
