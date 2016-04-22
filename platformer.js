(function() { // module pattern


	//-------------------------------------------------------------------------
	// POLYFILLS
	//-------------------------------------------------------------------------

	if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
		window.requestAnimationFrame =	window.webkitRequestAnimationFrame	|| 
										window.mozRequestAnimationFrame		|| 
										window.oRequestAnimationFrame		|| 
										window.msRequestAnimationFrame		|| 
										function(callback, element) {
											window.setTimeout(callback, 1000/60);
										}
	}


	//-------------------------------------------------------------------------
	// UTILITIES
	//-------------------------------------------------------------------------

	function timestamp() {
		return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
	}

	function bound(x, min, max) {
		return Math.max(min, Math.min(max, x));
	}

	function get(url, onsuccess) {
		var request = new XMLHttpRequest();
		request.onreadystatechange = function() {
			if ((request.readyState == 4) && (request.status == 200)) onsuccess(request);
		}
		request.open("GET", url, true);
		request.send();
	}

	function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
		return !(((x1 + w1 - 1) < x2)	||
				((x2 + w2 - 1) < x1)	||
				((y1 + h1 - 1) < y2)	||
				((y2 + h2 - 1) < y1));
	}


	//-------------------------------------------------------------------------
	// GAME CONSTANTS AND VARIABLES
	//-------------------------------------------------------------------------

	var MAP			= { tw: 64, th: 48 },
		TILE		= 32,
		METER		= TILE,
		GRAVITY		= 9.8 * 6,	// default (exagerated) gravity
		MAXDX		= 15,		// default max horizontal speed (15 tiles per second)
		MAXDY		= 60,		// default max vertical speed   (60 tiles per second)
		ACCEL		= 1/6,		// default take 1/6 second to reach maxdx (horizontal acceleration)
		FRICTION	= 1/5,		// default take 1/5 second to stop from maxdx (horizontal friction)
		IMPULSE		= 1500,		// default player jump impulse
		COLOR		= { BLACK: '#000000', WHITE: '#FFFFFF', YELLOW: '#ECD078', BRICK: '#D95B43', PINK: '#C02942', PURPLE: '#542437', GREY: '#333', SLATE: '#53777A', GOLD: 'gold' },
		COLORS		= [ COLOR.YELLOW, COLOR.BRICK, COLOR.PINK, COLOR.PURPLE, COLOR.GREY ],
		KEY			= { LEFT: 65, UP: 87, RIGHT: 68, FORCEUP: 73, SHOOT: 32 };
		
		IMG0 		= new Image();
		IMG0.src 	= 'images/back.jpg';
		IMG0.onload = function() { };
		
		
		IMG1 		= new Image();
		IMG1.src 	= 'images/playerLeft.png';
		IMG1.onload = function() { };
		
		IMG2 		= new Image();
		IMG2.src 	= 'images/playerRight.png';
		IMG2.onload = function() { };
		
		IMG3 		= new Image();
		IMG3.src 	= 'images/enemyLeft.png';
		IMG3.onload = function() { };
		
		IMG4 		= new Image();
		IMG4.src 	= 'images/enemyRight.png';
		IMG4.onload = function() { };
		
		IMG5 		= new Image();
		IMG5.src 	= 'images/player.png';
		IMG5.onload = function() { };
		
	var fps			= 60,
		step		= 1/fps,
		canvas		= document.getElementById('canvas'),
		ctx			= canvas.getContext('2d'),
		width		= canvas.width	= MAP.tw * TILE,
		height		= canvas.height	= MAP.th * TILE,
		player		= {},
		monsters	= [],
		traps		= [],
		cells		= [];

	var t2p		= function(t)		{ return t * TILE;					},
		p2t		= function(p)		{ return Math.floor(p/TILE);		},
		cell	= function(x, y)	{ return tcell(p2t(x), p2t(y));		},
		tcell	= function(tx, ty)	{ return cells[tx + (ty * MAP.tw)];	};


	//-------------------------------------------------------------------------
	// UPDATE LOOP
	//-------------------------------------------------------------------------

	function onkey(ev, key, down) {
		switch(key) {
			case KEY.LEFT:		player.left			= down; ev.preventDefault(); return false;
			case KEY.RIGHT:		player.right		= down; ev.preventDefault(); return false;
			case KEY.UP:		player.jump			= down; ev.preventDefault(); return false;
			case KEY.FORCEUP:	player.forcejump	= down; ev.preventDefault(); return false;
		}
	}

	function update(dt) {
		updatePlayer(dt);
		updateMonsters(dt);
		updateTraps();
	}

	function updatePlayer(dt) {
		updateEntity(player, dt);
	}

	function updateMonsters(dt) {
		var n, max;
		for(n = 0, max = monsters.length ; n < max ; n++)
			updateMonster(monsters[n], dt);
	}

	function updateMonster(monster, dt) {
		if (!monster.dead) {
			updateEntity(monster, dt);
			if (overlap(player.x, player.y, TILE, TILE, monster.x, monster.y, TILE, TILE)) {
				if ((player.dy > 0) && (monster.y - player.y > TILE/2))
					killMonster(monster);
				else
					killPlayer(player);
			}
		}
	}

	function updateTraps() {
		var n, max, trap;
		for(n = 0, max = traps.length ; n < max ; n++) {
			trap = traps[n];
			if (overlap(player.x, player.y, TILE, TILE, trap.x, trap.y, TILE, TILE))
				killPlayer(player);
		}
	}

	function killMonster(monster) {
		monster.dead = true;
	}

	function killPlayer(player) {
		player.x	= player.start.x;
		player.y	= player.start.y;
		player.dx	= 0;
		player.dy	= 0;
		
		var n, max;
		for(n = 0, max = monsters.length ; n < max ; n++)
			monsters[n].dead = false;
	}

	function updateEntity(entity, dt) {
		var wasleft		= entity.dx < 0,
			wasright	= entity.dx > 0,
			falling		= entity.falling,
			friction	= entity.friction * (falling ? 0.5 : 1),
			accel		= entity.accel * (falling ? 0.5 : 1);

		entity.ddx = 0;
		entity.ddy = entity.gravity;


		if (entity.left)
			entity.ddx = entity.ddx - accel;
		else if (wasleft)
			entity.ddx = entity.ddx + friction;

		if (entity.right)
			entity.ddx = entity.ddx + accel;
		else if (wasright)
			entity.ddx = entity.ddx - friction;


		if (!entity.jumping && !falling) {
			entity.forceready	= true;
			entity.jumpready	= true;
		}

		if (entity.jump && !entity.jumping && !falling) {
			entity.ddy			= entity.ddy - entity.impulse; 
			entity.jumping		= true;
			entity.jumpready 	= false;
		} 

		if (entity.forcejump && entity.forceready && entity.falling) {
			entity.dy			= 0;
			entity.ddy			= entity.ddy - entity.impulse;
			entity.forceready	= false;
		}


		entity.x	= entity.x + (dt * entity.dx);
		entity.y	= entity.y + (dt * entity.dy);
		entity.dx	= bound(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx);
		entity.dy	= bound(entity.dy + (dt * entity.ddy), -entity.maxdy, entity.maxdy);


		if ((wasleft  && (entity.dx > 0)) ||
			(wasright && (entity.dx < 0))) {
			entity.dx = 0;
		}


		var tx			= p2t(entity.x),
			ty			= p2t(entity.y),
			nx			= entity.x % TILE,
			ny			= entity.y % TILE,
			cell		= tcell(tx, ty),
			cellright	= tcell(tx + 1, ty),
			celldown	= tcell(tx, ty + 1),
			celldiag	= tcell(tx + 1, ty + 1);


		if (entity.dy > 0) {
			if ((celldown && !cell) || (celldiag && !cellright && nx)) {
				entity.y 		= t2p(ty);
				entity.dy 		= 0;
				entity.falling	= false;
				entity.jumping	= false;
				ny				= 0;
			}
		}
		else if (entity.dy < 0) {
			if ((cell && !celldown) || (cellright && !celldiag && nx)) {
				entity.y	= t2p(ty + 1);
				entity.dy	= 0;
				cell		= celldown;
				cellright	= celldiag;
				ny			= 0;
			}
		}

		if (entity.dx > 0) {
			if ((cellright && !cell) || celldiag  && !celldown && ny) {
				entity.x 	= t2p(tx);
				entity.dx 	= 0;
			}
		}
		else if (entity.dx < 0) {
			if ((cell && !cellright) || (celldown && !celldiag && ny)) {
				entity.x 	= t2p(tx + 1);
				entity.dx 	= 0;
			}
		}


		if (entity.monster) {
			if (entity.left && (cell || !celldown)) {
				entity.left 	= false;
				entity.right 	= true;
			}
			else if (entity.right && (cellright || !celldiag)) {
				entity.right	= false;
				entity.left		= true;
			}
		}

		entity.falling = !(celldown || (nx && celldiag));

	}


	//-------------------------------------------------------------------------
	// RENDERING
	//-------------------------------------------------------------------------

	function render(ctx, frame, dt) {
		ctx.clearRect(0, 0, width, height);
		renderMap(ctx);
		renderTraps(ctx, frame);
		renderPlayer(ctx, dt);
		renderMonsters(ctx, dt);
	}

	function renderMap(ctx) {
		var x, y, cell;
		ctx.drawImage(IMG0, 0, 0, width, height);
		for(y = 0 ; y < MAP.th ; y++) {
			for(x = 0 ; x < MAP.tw ; x++) {
				cell = tcell(x, y);
				if (cell) {
					ctx.fillStyle = COLORS[cell - 1];
					ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
				}
			}
		}
	}

	function renderPlayer(ctx, dt) {
		if (player.dx > 0)			ctx.drawImage(IMG2, player.x + (player.dx * dt) - TILE/4, player.y + (player.dy * dt) - TILE/2, TILE*1.5, TILE*1.5)
		else if (player.dx < 0) 	ctx.drawImage(IMG1, player.x + (player.dx * dt) - TILE/4, player.y + (player.dy * dt) - TILE/2, TILE*1.5, TILE*1.5)
		else 						ctx.drawImage(IMG5, player.x + (player.dx * dt) - TILE/4, player.y + (player.dy * dt) - TILE/2, TILE*1.5, TILE*1.5);
	}

	function renderMonsters(ctx, dt) {
		ctx.fillStyle = COLOR.SLATE;
		var n, max, monster;
		for(n = 0, max = monsters.length ; n < max ; n++) {
			monster = monsters[n];
			if (!monster.dead) {
				if (monster.dx >= 0) 	ctx.drawImage(IMG4, monster.x + (monster.dx * dt) - TILE/4, monster.y + (monster.dy * dt) - TILE/2, TILE*1.5, TILE*1.5); 
				else 					ctx.drawImage(IMG3, monster.x + (monster.dx * dt) - TILE/4, monster.y + (monster.dy * dt) - TILE/2, TILE*1.5, TILE*1.5);  
			}	
		}
	}

	function renderTraps(ctx, frame) {
		ctx.fillStyle	= COLOR.GOLD;
		ctx.globalAlpha	= 0.25 + tweenTrap(frame, 60);
		var n, max, trap;
		for(n = 0, max = traps.length ; n < max ; n++) {
			trap = traps[n];
			ctx.fillRect(trap.x, trap.y, TILE, TILE);
		}
		ctx.globalAlpha = 1;
	}

	function tweenTrap(frame, duration) {
		var half	= duration/2,
			pulse	= frame%duration;
		return pulse < half ? (pulse/half) : 1 - (pulse - half)/half;
	}


	//-------------------------------------------------------------------------
	// LOAD THE MAP
	//-------------------------------------------------------------------------

	function setup(map) {
		var data		= map.layers[0].data,
			objects		= map.layers[1].objects,
			n, obj, entity;

		for(n = 0 ; n < objects.length ; n++) {
			obj		= objects[n];
			entity	= setupEntity(obj);
			switch(obj.type) {
				case "player"	: player = entity; break;
				case "monster"	: monsters.push(entity); break;
				case "trap"	: traps.push(entity); break;
			}
		}

		cells = data;
	}

	function setupEntity(obj) {
		var entity 		= {};
		entity.x		= obj.x;
		entity.y		= obj.y;
		entity.dx		= 0;
		entity.dy		= 0;
		entity.gravity	= METER * (obj.properties.gravity	|| GRAVITY);
		entity.maxdx	= METER * (obj.properties.maxdx		|| MAXDX);
		entity.maxdy	= METER * (obj.properties.maxdy		|| MAXDY);
		entity.impulse	= METER * (obj.properties.impulse	|| IMPULSE);
		entity.accel	= entity.maxdx/(obj.properties.accel	|| ACCEL);
		entity.friction	= entity.maxdx/(obj.properties.friction	|| FRICTION);
		entity.monster	= obj.type == "monster";
		entity.player	= obj.type == "player";
		entity.trap		= obj.type == "trap";
		entity.left		= obj.properties.left;
		entity.right	= obj.properties.right;
		entity.start	= { x: obj.x, y: obj.y }

		return entity;
	}


	//-------------------------------------------------------------------------
	// THE GAME LOOP
	//-------------------------------------------------------------------------

	var counter = 0, dt = 0, now,
		last = timestamp(),
		fpsmeter = new FPSMeter({ decimals: 0, graph: true, theme: 'dark', left: '5px' });

	function frame() {
		fpsmeter.tickStart();
		now	= timestamp();
		dt	= dt + Math.min(1, (now - last)/1000);
		while(dt > step) {
			dt = dt - step;
			update(step);
		}
		render(ctx, counter, dt);
		last = now;
		counter++;
		fpsmeter.tick();
		requestAnimationFrame(frame, canvas);
	}

	document.addEventListener('keydown', function(ev) { return onkey(ev, ev.keyCode, true); }, false);
	document.addEventListener('keyup', function(ev) { return onkey(ev, ev.keyCode, false); }, false);

	get("level.json", function(req) {
		setup(JSON.parse(req.responseText));
		frame();
	});

})();
