s.Radar = new Class({
    toString: 'Radar',
    extend: s.Game,

    construct: function(options){

        this.game = options.game;
        var that = this.game;


        /////////////////////
        // SCENE AND INIT  //
        /////////////////////

        // Init THREE Environment
        that.radarScene = new THREE.Scene();
        that.radarCamera = new THREE.PerspectiveCamera( 40, 1, 1, 1000 );
        that.radarRenderer = this.renderer || new THREE.WebGLRenderer({ antialias: true });
        that.radar = '';

        // Append Renderer+Canvas
        that.radarRenderer.setSize( 256, 256 );
        that.radarCanvas = document.body.appendChild( that.radarRenderer.domElement );

        // Styling
        that.radarCanvas.style.position = 'absolute';
        that.radarCanvas.style.top = '0px';
        that.radarCanvas.style.left = window.innerWidth-256+"px";

        // Init Camera
        that.radarCamera.position.x = 0;
        that.radarCamera.position.y = 0;
        that.radarCamera.position.z = 180;
        that.radarScene.add( that.radarCamera );

        // Init Lights
        var light = new THREE.DirectionalLight( 0x000000 );
        light.position.set( 0, 1, 1 ).normalize();
        that.radarScene.add( light );

        that.radarScene.tempLog = [];



        ///////////////////////////////
        //  RADAR SPHERE PROPERTIES  //
        ///////////////////////////////

        that.radius = 60;

        var mesh = new THREE.MeshNormalMaterial(),
            sphere = new THREE.SphereGeometry( that.radius, 32, 32 );

        var materials = [
            //new THREE.MeshLambertMaterial( { color: 0xcccccc, shading: THREE.FlatShading, vertexColors: THREE.VertexColors } ),
            new THREE.MeshBasicMaterial( { color:0x5dfc0a, shading: THREE.FlatShading, wireframe: true, transparent: true } )
        ];

        var group = THREE.SceneUtils.createMultiMaterialObject( sphere, materials );
        group.position.x = 0;
        group.position.y = 0;
        group.position.z = 0;

        group.name = "radar";
        that.radarScene.add( group );


        ///////////////////////
        //  PLAYER LOCATION  //
        ///////////////////////

        // marker for player position
        var selfMarker = new THREE.Mesh(
            new THREE.SphereGeometry(2),
            new THREE.MeshBasicMaterial( { color: 0xabcdef, shading: THREE.FlatShading } ) );

        selfMarker.name = "self";

        that.radarScene.add( selfMarker );


        // marker for player motion
        var trajectoryGeo = new THREE.Geometry();
        trajectoryGeo.vertices.push(new THREE.Vector3(0,0,0));
        trajectoryGeo.vertices.push(new THREE.Vector3(0,0,0));

        var selfTrajectory = new THREE.Line(
            trajectoryGeo,
            new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 10 } ),
            THREE.LineStrip
        );
        selfTrajectory.name = "selfTrajectory";

        selfMarker.add( selfTrajectory );


        // moon instantiation
        var moonGeo = s.models.phobos_lofi.geometry;
        var moonMats = s.models.phobos_lofi.materials;
        moonMats[0].color.setHex(0x704030);
        var moonMarker = new THREE.Mesh( moonGeo, new THREE.MeshNormalMaterial(moonMats) );

        moonMarker.scale.multiplyScalar(0.005);
        moonMarker.name = "moon";

        that.radarScene.add( moonMarker );

//        var particleMaterial = new THREE.ParticleBasicMaterial({
//            color:0xffffff,
//            size: 10,
//            blending: THREE.AdditiveBlending,
//            transparent:true
//        });
//        var pX = Math.random() * 100 - 50;
//        var pY = Math.random() * 100 - 50;
//        var pZ = Math.random() * 100 - 50;
//        var particle = new THREE.Particle();
//
//        particle.velocity = new THREE.Vector3(1,0,0);
//        particleGeometry.vertices.push(particle);
//
//        var particleSystem = new THREE.ParticleSystem(particleGeometry, particleMaterial);
//        particleSystem.sortParticles = true;
//        that.radarScene.add(particleSystem);
        this.update = this.update.bind(this.game);
        that.hook(this.update);
        that.radarRenderer.render( that.radarScene, that.radarCamera );

    },
    update: function(options){
        //////////////////////////
        // RADAR RENDER SEGMENT //
        //////////////////////////

        var radar      = this.radarScene.getChildByName( 'radar' ),
            self       = this.radarScene.getChildByName( 'self' ),
            moon       = this.radarScene.getChildByName( 'moon' ),
            trajectory = self.getChildByName( 'selfTrajectory' );
        // Radar sphere rotation with respect to player's current rotation
        radar.rotation.y = this.player.root.rotation.y;

        // Clone of the current player's position
        var selfPosition = this.player.root.position.clone();

        // Distance from center of the map, scaled logarithmically
        var selfLength   = this.player.root.position.length();
        selfLength = Math.log( selfLength ) - 7 || 0.1;

        // Apply normalization and multiplier to cover full sphere coordinates and set the position
        self.position = selfPosition.normalize().multiplyScalar(selfLength*(this.radius/4));

        var playerTrajectory = this.player.root.getLinearVelocity().clone().multiplyScalar(1/40);
        playerTrajectory = playerTrajectory.length()>1 ? playerTrajectory : playerTrajectory.normalize().multiplyScalar(2);

        trajectory.geometry.vertices[1] = trajectory.geometry.vertices[0].clone().add( playerTrajectory );
        trajectory.geometry.verticesNeedUpdate = true;


        // moon radar positioning
        var moonPosition = this.scene.getChildByName( 'moon' ).position.clone();
        moon.position = moonPosition.normalize().multiplyScalar(this.radius);

    }
});
