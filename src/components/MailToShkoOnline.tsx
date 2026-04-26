/*
   Copyright 2026 Shko Online LLC <sales@shko.online>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

import { Link, Text } from "@fluentui/react-components";

function EncodeForMailto( input:string)
        {
            return input.replace(" ", "%20")
                        .replace("\n", "%0A")
                        .replace("\r", "")
                        .replace("&", "%26")
                        .replace("?", "%3F");
        }

const MailToShkoOnline: React.FC = () => {
    const subject = "Thanks for Dataverse Excel Reporter PPTB!";
    const body = `Hi,
thanks for this amazing tool!

I am interested in learning more about your products and services.

Best regards,
[Your Name]`;
    return (
        <Text align="center">
            Enjoying this free tool from Shko Online?<br />
            Contact us at{' '}
            <Link 
                rel="noopener"
                target="_top"
                href={`mailto:sales@shko.online?subject=${EncodeForMailto(subject)}&body=${EncodeForMailto(body)}`}
            >
            sales@shko.online
            </Link>
        </Text>
    );
};

export default MailToShkoOnline;