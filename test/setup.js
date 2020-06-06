require('@babel/register')({
  extensions: ['.ts']
});

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
