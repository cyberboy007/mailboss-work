const express = require('express');
const bodyParser = require('body-parser');
const parser = require('tld-extract');
const mongoose = require('mongoose');
const ejs = require('ejs');
require('dotenv').config();
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const crypto = require('crypto');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const { mainModule } = require('process');
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const schedule = require('node-schedule');

const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const apiSenderInstance = new SibApiV3Sdk.SendersApi();

let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(
	session({
		secret: process.env.SECRET,
		resave: false,
		saveUninitialized: false,
	})
);
app.use(passport.initialize());
app.use(passport.session());

const uri = process.env.LOGIN_URL;

mongoose.connect(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useFindAndModify: false,
});
mongoose.set('useCreateIndex', true);

const connection = mongoose.connection;
connection.once('open', () => {
	console.log('Mongodb connection Established');
});

const userSchema = new mongoose.Schema({
	username: { type: String, unique: true },
	password: String,
	googleId: String,
	fName: String,
	lName: String,
	sent_mails: { type: Number, default: 0 },
});

userSchema.plugin(passportLocalMongoose, { selectFields: 'username password googleId fName lName sent_mails' });
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

var forgotPasswordTokenSchema = new mongoose.Schema({
	_userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
	token: { type: String, required: true },
});

forgotPasswordTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 360 });

const ForgotPasswordToken = mongoose.model('ForgotPasswordToken', forgotPasswordTokenSchema);

const emailSchema = new mongoose.Schema({
	to: String,
	cc: [String],
	bcc: [String],
	subject: String,
	body: String,
	time: String,
});

const Email = mongoose.model('Email', emailSchema);

userSpecificEmailSchema = new mongoose.Schema({
	_userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
	emails: [emailSchema],
});

const UserSpecificEmail = new mongoose.model('UserSpecificEmail', userSpecificEmailSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
	done(null, user.id);
});

passport.deserializeUser(function (id, done) {
	User.findById(id, function (err, user) {
		done(err, user);
	});
});

passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.CLIENT_ID,
			clientSecret: process.env.CLIENT_SECRET,
			callbackURL: 'http://localhost:3000/auth/google/secrets',
			userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
		},
		function (accessToken, refreshToken, profile, cb) {
			User.findOrCreate(
				{
					googleId: profile.id,
					username: profile.emails[0].value,
					fName: profile.name.givenName,
					lName: profile.name.familyName,
				},
				function (err, user) {
					let address = user.username.split('@').pop();
					let opts = {
						ip: '1.1.1.1',
						domain: address,
					};

					apiSenderInstance.getSenders(opts).then(
						function (data) {
							data = data['senders'];
							let i;
							for (i = 0; i < data.length; i++) {
								if (data[i].email === user.username) {
									break;
								}
							}
							if (i === data.length) {
								let opts = {
									sender: new SibApiV3Sdk.CreateSender(),
								};
								let address = user.username.split('@').pop();
								opts.sender = {
									email: user.username,
									ips: [
										{
											ip: '1.1.1.1',
											domain: address,
										},
									],
									name: user.fName + ' ' + user.lName,
								};
								apiSenderInstance.createSender(opts).then(
									function (data) {
										console.log('API called successfully. Returned data: ' + JSON.stringify(data));
									},
									function (error) {
										console.log(error);
									}
								);
							}
						},
						function (error) {
							console.log(error);
						}
					);
					return cb(err, user);
				}
			);
		}
	)
);

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/secrets', passport.authenticate('google', { failureRedirect: '/login' }), function (req, res) {
	let address = req.user.username.split('@').pop();
	let opts = {
		ip: '1.1.1.1',
		domain: address,
	};

	apiSenderInstance.getSenders(opts).then(
		function (data) {
			data = data['senders'];
			let i;
			for (i = 0; i < data.length; i++) {
				if (data[i].email === req.user.username) {
					if (data[i].active === true) {
						res.render('status', {
							status: 'Congratulations! Your account is activated now you could send 50 emails per day for free!',
						});
					}
				}
			}
			if (i === data.length) {
				res.render('status', {
					status: 'Your account has not been activated yet! Please wait while our team works on the activation process. This may take 1-2 hours... till then lookout for a mail from SendinBlue and please verify your account as asked for and you need not login or signup to sendinblue',
				});
			}
		},
		function (error) {
			console.error(error);
		}
	);
});

app.get('/compose', function (req, res) {
	if (req.user) {
		res.render('compose');
	} else {
		res.redirect('/');
	}
});

// home page route
app.get('/', function (req, res) {
	res.render('home-page');
});

// signup route
app.get('/register', function (req, res) {
	res.render('register');
});

// login route
app.get('/login', function (req, res) {
	res.render('login');
});

app.get('/landing-page', (req, res) => {
	if (req.user) {
		UserSpecificEmail.findOne({_userId: req.user._id}, (err, userEmails) => {
			if(userEmails){
				res.render('landing_page', {emailList: userEmails.emails})
			}
			else {
				res.render('landing_page');
			}
		});
	} else {
		res.redirect('/login');
	}
});

app.get('/logout', (req, res) => {
	req.logOut();
	res.redirect('/');
});

app.get('/forgot-password', (req, res) => {
	res.render('new-pass');
});

app.get('/sent_reset_link', (req, res) => {
	res.render('sent-reset-link');
});

app.post('/send-mail-now', (req, res) => {
	var datecontent;
	var timecontent;

	// calling the scheduled function
	datecontent = req.body.tripStart;
	const dateArray = datecontent.split('-');
	timecontent = req.body.appt;
	const timeArray = timecontent.split(':');
	const date = new Date(dateArray[0], dateArray[1] - 1, dateArray[2], timeArray[0], timeArray[1], 0);
	const to = req.body.to;
	let cc_list = req.body.cc.split(',');
	let cc = [];
	if (cc_list[0] !== '') {
		for (let i = 0; i < cc_list.length; i++) {
			cc.push({
				email: cc_list[i],
			});
		}
	} else {
		cc_list = [];
	}
	let bcc_list = req.body.bcc.split(',');
	let bcc = [];
	if (bcc_list[0] !== '') {
		for (let i = 0; i < bcc_list.length; i++) {
			bcc.push({
				email: bcc_list[i],
			});
		}
	} else {
		bcc_list = [];
	}

	let email = new Email({
		to: to,
		cc: cc_list,
		bcc: bcc_list,
		subject: req.body.subject,
		body: req.body.htmlContent,
		time: datecontent + ' ' + timecontent,
	});

	UserSpecificEmail.findOne({ _userId: req.user._id }, (err, userEmails) => {
		if (!userEmails) {
			let userEmails = new UserSpecificEmail({
				_userId: req.user._id,
				emails: [email],
			});
			userEmails.save();
		} else {
			userEmails.emails.push(email);
			userEmails.save();
		}
	});

	if (req.user) {
		const job = schedule.scheduleJob(date, function () {
			var sentMails = req.user.sent_mails;
			if (sentMails < 50) {
				if (1 + cc.length + bcc.length + sentMails < 50) {
					if (cc.length > 0 && bcc.length > 0) {
						sendSmtpEmail = {
							to: [
								{
									email: to,
								},
							],
							cc: cc,
							bcc: bcc,
							sender: {
								email: req.user.username,
							},
							subject: req.body.subject,
							htmlContent: req.body.htmlContent,
							headers: {
								'api-key': process.env.API_KEY,
								'content-type': 'application/json',
								accept: 'application/json',
							},
						};
					} else if (bcc.length > 0) {
						sendSmtpEmail = {
							to: [
								{
									email: to,
								},
							],
							bcc: bcc,
							sender: {
								email: req.user.username,
							},
							subject: req.body.subject,
							htmlContent: req.body.htmlContent,
							headers: {
								'api-key': process.env.API_KEY,
								'content-type': 'application/json',
								accept: 'application/json',
							},
						};
					} else if (cc.length > 0) {
						sendSmtpEmail = {
							to: [
								{
									email: to,
								},
							],
							cc: cc,
							sender: {
								email: req.user.username,
							},
							subject: req.body.subject,
							htmlContent: req.body.htmlContent,
							headers: {
								'api-key': process.env.API_KEY,
								'content-type': 'application/json',
								accept: 'application/json',
							},
						};
					} else {
						sendSmtpEmail = {
							to: [
								{
									email: to,
								},
							],
							sender: {
								email: req.user.username,
							},
							subject: req.body.subject,
							htmlContent: req.body.htmlContent,
							headers: {
								'api-key': process.env.API_KEY,
								'content-type': 'application/json',
								accept: 'application/json',
							},
						};
					}
					apiInstance.sendTransacEmail(sendSmtpEmail).then(
						function (data) {
							sentMails += 1 + cc_list.length + bcc_list.length;
							console.log('mail sent successfully');
						},
						function (error) {
							console.error(error);
						}
					);
				} else {
					//flash card redirect
				}
			} else {
				// flash card redirect
			}
		});
	} else {
		res.redirect('/');
	}

	res.redirect('/landing-page');
});

app.post('/register', (req, res) => {
	let user1 = req.body.username;
	User.findOne({ username: req.body.username }, (err, user) => {
		if (!user) {
			User.register(
				{
					username: req.body.username,
					fName: req.body.fName,
					lName: req.body.lName,
				},
				req.body.password,
				function (err, user) {
					if (err) {
						console.log(err);
						res.redirect('/register');
					} else {
						let opts = {
							sender: new SibApiV3Sdk.CreateSender(),
						};
						let address = user1.split('@').pop();
						opts.sender = {
							email: user.username,
							ips: [
								{
									ip: '1.1.1.1',
									domain: address,
								},
							],
							name: user.fName + ' ' + user.lName,
						};
						apiSenderInstance.createSender(opts).then(
							function (data) {
								console.log('API called successfully. Returned data: ' + JSON.stringify(data));
								passport.authenticate('local')(req, res, function () {
									res.render('status', {
										status: 'Your account has not been activated yet! Please wait while our team works on the activation process. This may take 1-2 hours... till then lookout for a mail from SendinBlue and please verify your account as asked for and you need not login or signup to sendinblue',
									});
								});
							},
							function (error) {
								console.log(error);
							}
						);
					}
				}
			);
		} else {
			res.send('your account is already registered with us please login');
		}
	});
});

app.post('/login', (req, res) => {
	const user1 = req.body.username;
	const user = new User({
		password: req.body.password,
		username: req.body.username,
	});
	req.logIn(user, function (err) {
		if (err) {
			console.log(err);
			res.redirect('/login');
		} else {
			let address = user1.split('@').pop();
			let opts = {
				ip: '1.1.1.1',
				domain: address,
			};
			apiSenderInstance.getSenders(opts).then(
				function (data) {
					data = data['senders'];
					for (let i = 0; i < data.length; i++) {
						if (data[i].email === user.username) {
							if (data[i].active === true) {
								passport.authenticate('local')(req, res, function () {
									res.render('status', {
										status: 'Congratulations! Your account is activated now you could send 50 emails per day for free!',
									});
								});
							} else {
								passport.authenticate('local')(req, res, function () {
									res.render('status', {
										status: 'Your account has not been activated yet! Please wait while our team works on the activation process. This may take 1-2 hours... till then lookout for a mail from SendinBlue and please verify your account as asked for and you need not login or signup to sendinblue',
									});
								});
							}
						}
					}
				},
				function (error) {
					console.log(error);
				}
			);
		}
	});
});

app.post('/forgot-password', function (req, res) {
	User.findOne({ username: req.body.username }, function (err, user) {
		// check if the user exists
		if (!user) {
			return res
				.status(400)
				.send({ msg: 'We were unable to find a user with that email. Make sure your Email is correct!' });
		} else {
			var forgotPasswordToken = new ForgotPasswordToken({
				_userId: user._id,
				token: crypto.randomBytes(20).toString('hex'),
			});
			forgotPasswordToken.save(function (err) {
				if (err) {
					return res.status(500).send({ msg: err.message });
				}
				// Send email (use credentials of sendinblue)

				sendSmtpEmail = {
					to: [{ email: user.username }],
					sender: {
						email: process.env.ACCOUNT,
					},
					subject: 'RESET PASSWORD LINK',
					htmlContent:
						'<h1>Hello ' +
						user.fName +
						'</h1>' +
						'<a href="https://' +
						req.headers.host +
						'/reset/password' +
						user.email +
						'/' +
						forgotPasswordToken.token +
						'">Click here to reset password</a>' +
						'<p>if the above given link is not working, please copy this in your browser:</p>' +
						'<p>http://' +
						req.headers.host +
						'/reset/password/' +
						user.username +
						'/' +
						forgotPasswordToken.token +
						'</p>',
					headers: {
						'api-key': process.env.API_KEY,
						'content-type': 'application/json',
						accept: 'application/json',
					},
				};
				apiInstance.sendTransacEmail(sendSmtpEmail).then(
					function (data) {
						console.log('mail sent successfully');
						res.redirect('/sent_reset_link');
					},
					function (error) {
						console.error(error);
					}
				);
			});
		}
	});
});

app.get('/reset/password/:email/:token', (req, res) => {
	ForgotPasswordToken.findOne({ token: req.params.token }, function (err, resetPasswordToken) {
		// token is not found into database i.e. token may have expired
		if (!resetPasswordToken) {
			return res.status(400).send({
				msg: 'Your reset password token may have expired. Please click on forgot password to try again.',
			});
		}
		// if token is found then check valid user
		else {
			User.findOne({ _id: resetPasswordToken._userId, username: req.params.email }, function (err, user) {
				// not valid user
				if (!user) {
					return res.status(401).send({ msg: 'We were unable to find a user for this link. Please SignUp!' });
				}
				// send the reset password page for the user that is not logged in
				else {
					if (req.user) {
						return res.status(200).send({
							msg: 'You are already logged in, Please check reset password for changing your password',
						});
					} else {
						res.render('confirm-pass', { token: resetPasswordToken.token, email: user.username });
					}
				}
			});
		}
	});
});

app.post('/reset-password/:email/:token', (req, res) => {
	User.findByUsername(req.params.email).then((user) => {
		if (user) {
			user.setPassword(req.body.password, function () {
				user.save();
				res.redirect('/login');
			});
		} else {
			res.status(500).json({ message: 'This user does not exist' });
		}
	}),
		function (err) {
			console.error(err);
		};
});

app.listen(process.env.PORT || 3000, function () {
	console.log('server is running on 3000');
});
