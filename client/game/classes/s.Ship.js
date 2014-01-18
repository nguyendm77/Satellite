s.Ship = new Class({
	extend: s.GameObject,

    options: {
        leftTurretOffset: new THREE.Vector3(35, 0, -200),
        rightTurretOffset: new THREE.Vector3(-35, 0, -200),
        missileOffset: new THREE.Vector3(0, 0, -120),
        turretFireTime: 200,
        missileFireTime: 1000
    },

    botOptions: {
        rotationSpeed: Math.PI/2,
        pitchSpeed: Math.PI/4,
        yawSpeed: Math.PI/4,
        thrustImpulse: 0,
        brakePower: 0.85,
        velocityFadeFactor: 16,
        rotationFadeFactor: 4
    },

	construct: function(options) {

        this.HUD = options.HUD;
		var geometry = s.models[options.shipClass].geometry;
		this.materials = s.models[options.shipClass].materials[0];
        this.materials.emissive = new THREE.Color('rgb(255,255,255)');

        var physiMaterial = Physijs.createMaterial(this.materials);
		this.root = new Physijs.ConvexMesh(geometry, physiMaterial, 100);
		this.root.position.copy(options.position);
		this.root.rotation.copy(options.rotation);

        this.lastTurretFire = 0;
        this.lastMissileFire = 0;
        this.alliance = options.alliance;

        this.game = options.game;
        this.name = options.name || '';

        this.root.name = this.name;
        this.hull = s.config.ship.hull;
        this.shields = s.config.ship.shields;


        this.controlBot = this.controlBot.bind(this);
        if (options.name.slice(0,3) === 'bot') {
            if (this.game.lastBotCallback) { this.game.unhook( this.game.lastBotCallback ); }
            this.game.hook( this.controlBot );
            this.game.lastBotCallback = this.controlBot;
        }

        this.lastTime = new Date( ).getTime( );

	},

    getOffset: function(offset) {
        return offset.clone().applyMatrix4(this.root.matrixWorld);
    },

	fire: function(weapon){
		var now =new Date().getTime();
        var position;
        var rotation = this.root.rotation.clone();
        var initialVelocity = this.root.getLinearVelocity().clone();

        // Turrets
        if (weapon === 'turret'){
            if (now - this.lastTurretFire > this.options.turretFireTime){
                // Left bullet
                position = this.getOffset(this.options.leftTurretOffset);
                new s.Turret({
                    HUD: this.HUD,
                    game: this.game,
                    pilot: this.game.pilot.name,
                    position: position,
                    rotation: rotation,
                    initialVelocity: initialVelocity,
                    team: this.alliance
                });
                this.game.handleFire({
                    position: position,
                    rotation: rotation,
                    initialVelocity: initialVelocity
                });

                // Right bullet
                position = this.getOffset(this.options.rightTurretOffset);
                new s.Turret({
                    HUD: this.HUD,
                    game: this.game,
                    pilot: this.game.pilot.name,
                    position: position,
                    rotation: rotation,
                    initialVelocity: initialVelocity,
                    team: this.alliance
                });
                this.game.handleFire({
                    position: position,
                    rotation: rotation,
                    initialVelocity: initialVelocity
                });

                this.lastTurretFire = now;

                this.game.sound.play('laser', 0.5);
            }
        }

        // Missiles
        if (weapon === 'missile'){
            if(now - this.lastMissileFire > this.options.missileFireTime){
                position = this.getOffset(this.options.missileOffset);

                new s.Missile({
                    game: this.game,
                    position: position,
                    rotation: rotation,
                    initialVelocity: initialVelocity,
                    team: this.alliance
                });

                this.lastMissileFire = now;
            }
        }
    },

    setPosition: function (position, rotation, aVeloc, lVeloc, interpolate) {
        var posInterpolation = 0.05;
        var rotInterpolation = 0.50;

        if (interpolate) {
            // Interpolate position by adding the difference of the calculated position and the position sent by the authoritative client
            var newPositionVec = new THREE.Vector3(position[0], position[1], position[2]);
            var posErrorVec = newPositionVec.sub(this.root.position).multiply(new THREE.Vector3(posInterpolation, posInterpolation, posInterpolation));
            this.root.position.add(posErrorVec);
        }
        else {
            // Directly set position
            this.root.position.set(position[0], position[1], position[2]);
        }

        // Set rotation
        if (rotation)
            this.root.rotation.set(rotation[0], rotation[1], rotation[2]);

        if (aVeloc !== undefined && this.root.setAngularVelocity)
            this.root.setAngularVelocity({ x: aVeloc[0], y: aVeloc[1], z: aVeloc[2] });

        if (lVeloc !== undefined && this.root.setLinearVelocity)
            this.root.setLinearVelocity({ x: lVeloc[0], y: lVeloc[1], z: lVeloc[2] });

        // Tell the physics engine to update our position
        this.root.__dirtyPosition = true;
        this.root.__dirtyRotation = true;
    },


    getPositionPacket: function() {
        var root = this.getRoot();

        // Position & rotation
        var shipPosition = (root && root.position) || new THREE.Vector3();
        var shipRotation = (root && root.rotation) || new THREE.Vector3();

        // Velocity
        var linearVelocity = (root.getLinearVelocity && root.getLinearVelocity()) || new THREE.Vector3();
        var angularVelocity = (root.getAngularVelocity && root.getAngularVelocity()) || new THREE.Vector3();

        return {
            pos: [shipPosition.x, shipPosition.y, shipPosition.z],
            rot: [shipRotation.x, shipRotation.y, shipRotation.z],
            aVeloc: [angularVelocity.x, angularVelocity.y, angularVelocity.z],
            lVeloc: [linearVelocity.x, linearVelocity.y, linearVelocity.z]
        };
    },

    getForceVector: function(){

        // Extract the rotation from the projectile's matrix
        var rotationMatrix = new THREE.Matrix4();
        rotationMatrix.extractRotation(this.root.matrix);

        // Apply bullet impulse in the correct direction
        return new THREE.Vector3(0, 0, 1500 * -1).applyMatrix4(rotationMatrix);
    },

    handleDie: function(){
        this.destruct();
    },

    controlBot: function( ) {

        var now = new Date( ).getTime( );
        var difference = now - this.lastTime;

        var pitch = 0;
        var roll = 0;
        var yaw = 0;

        var thrust = 0;
        var brakes = 0;

        var thrustScalar = this.botOptions.thrustImpulse/s.config.ship.maxSpeed + 1;
        

        var yawSpeed    = this.botOptions.yawSpeed,
            pitchSpeed  = this.botOptions.pitchSpeed;


        //if need left
        yaw = yawSpeed / thrustScalar;
        //if need right
        yaw = -1 * yawSpeed / thrustScalar;
        //if need down
        pitch = -1*pitchSpeed / thrustScalar;
        //if need up
        pitch  = pitchSpeed / thrustScalar;

        //////////////////////////////
        // SPEED/DISTANCE LOG //
        //////////////////////////////

        
         var botX          = this.root.position.x,
             botY          = this.root.position.y,
             botZ          = this.root.position.z,
             humanX        = this.game.player.root.position.x,
             humanY        = this.game.player.root.position.y,
             humanZ        = this.game.player.root.position.z,
             xDistance     = botX - humanX,
             yDistance     = botY - humanY,
             zDistance     = botZ - humanZ,
             totalDistance = Math.sqrt( Math.pow(xDistance, 2) + Math.pow(yDistance, 2) + Math.pow(yDistance, 2) ),
             maxDistance = 4100,
             minDistance = 1500;

        if (totalDistance > maxDistance) {
            thrust = 1;
        }
        else if (totalDistance < minDistance) {
            brakes = 1;
        } else {
            var ratio = (totalDistance - minDistance) / (maxDistance - minDistance);
            var optimumSpeed = s.config.ship.maxSpeed * ratio;
            if (optimumSpeed < this.botOptions.thrustImpulse) { brakes = 1; }
            if (optimumSpeed > this.botOptions.thrustImpulse) { thrust = 1; }
        }

        if (thrust && this.botOptions.thrustImpulse < s.config.ship.maxSpeed){
            this.botOptions.thrustImpulse += difference;
        }

        if (brakes && this.botOptions.thrustImpulse > 0){
            this.botOptions.thrustImpulse -= difference;
        }       
            
        //////////////////////////////
        // MOTION AND PHYSICS LOGIC //
        //////////////////////////////


        var linearVelocity = this.root.getLinearVelocity().clone();
        var angularVelocity = this.root.getAngularVelocity().clone();
        var rotationMatrix = new THREE.Matrix4();
        rotationMatrix.extractRotation(this.root.matrix);

        angularVelocity = angularVelocity.clone().divideScalar(this.botOptions.rotationFadeFactor);
        this.root.setAngularVelocity(angularVelocity);

        var newAngularVelocity = new THREE.Vector3(pitch, yaw, roll).applyMatrix4(rotationMatrix).add(angularVelocity);
        this.root.setAngularVelocity(newAngularVelocity);

        var impulse = linearVelocity.clone().negate();
        this.root.applyCentralImpulse(impulse);

        var getForceVector = new THREE.Vector3(0,0, -1*this.botOptions.thrustImpulse).applyMatrix4(rotationMatrix);
        this.root.applyCentralImpulse(getForceVector);

        this.lastTime = now;
    }
});
