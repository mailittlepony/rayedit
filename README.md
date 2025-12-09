
<!-- PROJECT SHIELDS -->
![Stargazers](https://img.shields.io/github/stars/mailittlepony/rayedit)
![Forks](https://img.shields.io/github/forks/mailittlepony/rayedit)
![MIT License](https://img.shields.io/github/license/mailittlepony/rayedit)


<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/mailittlepony/rayflow">
    <img src="/images/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">rayedit</h3>

  <p align="center">
    A simple Ray Marching Scene Editor.
    <br />
    <br />
    <a href="https://mailittlepony.github.io/rayedit">View Demo</a>
  </p>
</div>

## Overview

[![Screen Shot](/images/demo.png)](https://mailittlepony.github.io/rayedit)

This project is an experimental WebGPU-based 3D editor built with TypeScript and powered by ray marching. It focuses on simplicity, real-time interaction, and a clean UI that lets you build and explore procedural scenes without heavy engines or complex tooling.

[![Demo](/images/demo.gif)](https://mailittlepony.github.io/rayedit)
<p align="center"><i>Demo</i></p>

You can add unlimited primitives, manipulate them directly in the viewport, and customize their properties through intuitive panels—all rendered using a single ray-marching pipeline.

The goal of the project is to serve as a lightweight playground for experimenting with signed distance fields (SDFs), procedural rendering techniques, and interactive scene editing in the browser. (_soon_)

### Features

* **Object selection**: Select objects from the Scene Manager or by clicking on them.

* **Unlimited primitives**: Add or delete any number of shapes (Cuboid, Ellipsoid, Torus, Cone, and more) from the toolbox.

* **Real-time editing**: Modify any object’s properties instantly through the Inspector Panel, including Position, Rotation, Scale, Color

* **Gizmo support** - Use the translation and freegrab gizmo to move objects interactively within the scene. (More gizmo modes coming soon.)

* **Custom SDF and operations** - Use the code editor to make your own SDFs and operations such as smoothmin, smoothmax etc.

### Using

* WebGPU
* TypeScript

<!-- GETTING STARTED -->
## Getting Started

Setting up the project is quick and straightforward.

### Prerequisites

* Node.js (> v24)
* Recent browser supporting WebGPU

### Installation

2. Clone the repo
   ```sh
   git clone https://github.com/mailittlepony/rayedit.git
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
5. Start the development server
   ```sh
   npm run dev
   ```

<!-- ROADMAP -->
## Roadmap

- [x] Feature basic interactivity
- [x] Create any primitives
- [x] Add translation gizmo
- [x] Add custom object (with user-custom written SDF or primitive combination)
- [ ] Make multiple custom sdf
- [ ] Make panels clickable to move and close
- [ ] Add gizmos (rotation, scaling, ...)
- [ ] Add interaction between objects

## Acknowledgement

This project was mainly possible thanks to my favorite teacher [stantonik](https://github.com/stantonik).

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

---
