const express = require('express');
const router = express.Router();
const { PolicyExecutionSupporter } = require('../models');
const credentials = require('../config/credentials');
const settings = require('../config/settings');
const email = require('../utils/email');
require('../utils/handleAsyncErrors').fixRouter(router);

router.post('/webhook', express.raw({type: 'application/json'}), async (req, res,) => {
	const stripe = require('stripe')(credentials.stripe.secretKey);

	//express.raw();

	const sig = req.headers['stripe-signature'];
	const endpointSecret = settings.stripe.webhookEndpointSecret;
	let success = true;

	let event;

	try {
		event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
	} catch (err) {
		res.status(400).send(`Webhook Error: ${err.message}`);
		return;
	}

	let log = `Received ${event.type}
${JSON.stringify(event, null, 2)}
`;

	// Handle the event
	switch(event.type) {
		case 'checkout.session.completed':
			let checkoutSession = event.data.object;
			let policyExecutionSupporter = await PolicyExecutionSupporter.findOne({ where: { stripeCheckoutSessionId: checkoutSession.id }});
			if(policyExecutionSupporter) {
				log += `Found policyExecutionSupporter (ID=${policyExecutionSupporter.id}\n`;
				if(checkoutSession.payment_status == "paid") {
					policyExecutionSupporter.stripeCheckoutSessionPaid = true;
					await policyExecutionSupporter.save();
					log += `Set policyExecutionSupporter.stripeCheckoutSessionPaid = true\n`;
				} else {
					log += `ERROR: Expected payment_status="paid", got payment_status="${checkoutSession.payment_status}"\n`;
					success = false;
				}
			} else {
				log += `ERROR: couldn't find policyExecutionSupporter with stripeCheckoutSessionId=${checkoutSession.id}\n`;
				success = false;
			}
			break;
		default:
			log += `Unhandled event type ${event.type}`;
			res.send(400);
			success = false;
	}

	email.send(req.app.get('env'), {
		from: 'noreply@becomepluribus.com',
		to: 'pluribus-dev.prone832@passmail.net',
		subject: 'Pluribus Stripe WebHook: ' + (success ? "Success" : "Failure"),
		text: `Log:
${log}`
	});

	// Return a 200 response to acknowledge receipt of the event
	res.send();

});

module.exports = router;