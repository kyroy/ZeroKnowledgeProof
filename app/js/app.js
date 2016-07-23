/* global angular */

angular.module('ZeroKnowledgeProof', ['ngRoute', 'ngAnimate']);
angular.module('ZeroKnowledgeProof').config(function ($routeProvider) {
  $routeProvider.when('/', {
    templateUrl: 'GraphColoringProblem.html',
    controller: 'GraphColoringProblemController as graphCtrl'
  }).when('/:id', {
    templateUrl: 'GraphColoringProblem.html',
    controller: 'GraphColoringProblemController as graphCtrl',
    reloadOnSearch: false
  })
  .otherwise({ redirectTo: '/' });
});
