// Responsibility: register exactly one Stimulus application and its page controllers.
import { application } from "./application";
import BasemapDiagnosticController from "./basemap_diagnostic_controller";
import MapController from "./map_controller";

application.register("basemap-diagnostic", BasemapDiagnosticController);
application.register("map", MapController);
