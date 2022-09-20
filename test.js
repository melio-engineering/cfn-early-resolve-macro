const { handler } = require('./early-resolve');

process.env.TEST = true;

const template = {
  "accountId": "1234567890",
  "fragment": {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description": "early-resolve-test",
    "Parameters": {
      "Environment": {
        "Type": "String"
      }
    },
    "Resources": {
      "SampleResource": {
        "Type": "AWS::None::Resource",
        "Properties": {
          "SimpleResolve": "{{early-resolve:ssm:/${Environment}/infra/sample-resolve}}",
          "ArrayResolve": [
            "partially-{{early-resolve:ssm:/${Environment}/infra/resource-arn}}"
          ],
          "ArrayMultiResolve": [
            {
              "Key": "melio:early-resolve-test-1",
              "Value": "multi-key-1-{{early-resolve:ssm:/${Environment}/infra/hello}}"
            },
            {
              "Key": "melio:early-resolve-test-2",
              "Value": "multi-key-2-{{early-resolve:ssm:/${Environment}/infra/hello}}"
            }
          ]
        }
      }
    }
  },
  "transformId": "1234567890::EarlyResolve",
  "requestId": "b7af92d7-d0fd-4fb7-a5b5-614deb2c36be",
  "region": "eu-central-1",
  "params": {},
  "templateParameterValues": {
    "Environment": "sample-environment"
  }
};

// Handle a duplicated object so that we can compare
handler(JSON.parse(JSON.stringify(template)), {}).then((result) => {
  console.assert(result.fragment.Resources.SampleResource.Properties.SimpleResolve === 'mocked', 'Failed to resolve SimpleValue');
  console.assert(result.fragment.Resources.SampleResource.Properties.ArrayResolve[0] === 'partially-mocked', 'Failed to resolve array');
  console.assert(result.fragment.Resources.SampleResource.Properties.ArrayMultiResolve[0].Value === 'multi-key-1-mocked', 'Failed to resolve multi array 1');
  console.assert(result.fragment.Resources.SampleResource.Properties.ArrayMultiResolve[1].Value === 'multi-key-2-mocked', 'Failed to resolve multi array 2');
});
